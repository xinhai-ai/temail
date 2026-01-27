/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

function detectDatabaseType() {
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgresql";
  }
  return "sqlite";
}

function createPrismaClient() {
  const databaseType = detectDatabaseType();
  if (databaseType === "postgresql") {
    // PostgreSQL with pg adapter
    const { PrismaPg } = require("@prisma/adapter-pg");
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    return new PrismaClient({ adapter });
  }
  // SQLite with libsql adapter
  const { PrismaLibSql } = require("@prisma/adapter-libsql");
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getArgValue(name) {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseIntOr(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveEnvString(name) {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

function createRandomPassword() {
  return crypto.randomBytes(18).toString("base64url");
}

function isMissingTableError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  // SQLite: "no such table"
  // PostgreSQL: "relation ... does not exist"
  return lower.includes("no such table") || lower.includes("does not exist");
}

async function waitForUserTable(prisma, options) {
  const timeoutMs = options.timeoutMs;
  const intervalMs = options.intervalMs;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      // This fails if migrations haven't been applied yet.
      await prisma.user.count();
      return { ok: true };
    } catch (error) {
      if (!isMissingTableError(error)) {
        console.error("[bootstrap] waiting for database failed:", error instanceof Error ? error.message : error);
      }
      await sleep(intervalMs);
    }
  }

  return { ok: false, error: `Timeout waiting for database schema (${Math.round(timeoutMs / 1000)}s)` };
}

async function waitForExistingUser(prisma, options) {
  const timeoutMs = options.timeoutMs;
  const intervalMs = options.intervalMs;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const count = await prisma.user.count();
      if (count > 0) return { ok: true, count };
    } catch (error) {
      if (!isMissingTableError(error)) {
        console.error("[bootstrap] waiting for users failed:", error instanceof Error ? error.message : error);
      }
    }
    await sleep(intervalMs);
  }

  return { ok: false, error: `Timeout waiting for users (${Math.round(timeoutMs / 1000)}s)` };
}

async function ensureBootstrapAdmin(prisma) {
  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    console.log(`[bootstrap] users already exist (${existingCount}), skipping bootstrap`);
    return;
  }

  // Support both naming conventions for environment variables
  const email = resolveEnvString("BOOTSTRAP_ADMIN_EMAIL") || resolveEnvString("BOOTSTRAP_SUPER_ADMIN_MAIL") || "admin@temail.local";
  const name = resolveEnvString("BOOTSTRAP_ADMIN_NAME") || "Admin";
  const role = resolveEnvString("BOOTSTRAP_ADMIN_ROLE") || "SUPER_ADMIN";
  const configuredPassword = resolveEnvString("BOOTSTRAP_ADMIN_PASSWORD") || resolveEnvString("BOOTSTRAP_SUPER_ADMIN_SECRET");
  const password = configuredPassword || createRandomPassword();

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role,
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      console.log("[bootstrap] user already created by another process, skipping");
      return;
    }
    throw error;
  }

  console.log(`[bootstrap] created ${role} user: ${email}`);
  if (!configuredPassword) {
    console.log(`[bootstrap] generated password: ${password}`);
  } else {
    console.log("[bootstrap] password provided via environment variable");
  }
}

async function main() {
  const waitOnly = process.argv.includes("--wait");
  const timeoutSeconds =
    parseIntOr(getArgValue("--timeout-seconds"), undefined) ??
    parseIntOr(resolveEnvString("BOOTSTRAP_WAIT_SECONDS"), 180);
  const intervalMs = parseIntOr(resolveEnvString("BOOTSTRAP_POLL_INTERVAL_MS"), 1000);

  const prisma = createPrismaClient();

  try {
    const schemaReady = await waitForUserTable(prisma, {
      timeoutMs: timeoutSeconds * 1000,
      intervalMs,
    });
    if (!schemaReady.ok) {
      console.error(`[bootstrap] ${schemaReady.error}`);
      process.exitCode = 1;
      return;
    }

    if (waitOnly) {
      const ready = await waitForExistingUser(prisma, {
        timeoutMs: timeoutSeconds * 1000,
        intervalMs,
      });
      if (!ready.ok) {
        console.error(`[bootstrap] ${ready.error}`);
        process.exitCode = 1;
        return;
      }
      console.log(`[bootstrap] detected users (${ready.count}), continuing`);
      return;
    }

    await ensureBootstrapAdmin(prisma);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error("[bootstrap] fatal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
