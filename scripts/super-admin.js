/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const SCRIPT_PREFIX = "[super-admin-cli]";

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
    try {
      const { PrismaPg } = require("@prisma/adapter-pg");
      const adapter = new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      });
      return new PrismaClient({ adapter });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to initialize PostgreSQL adapter (@prisma/adapter-pg). ` +
          `Please run npm ci in the current runtime environment. Original error: ${message}`
      );
    }
  }

  try {
    const { PrismaLibSql } = require("@prisma/adapter-libsql");
    const adapter = new PrismaLibSql({
      url: process.env.DATABASE_URL || "file:./dev.db",
    });
    return new PrismaClient({ adapter });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to initialize SQLite adapter (@prisma/adapter-libsql). ` +
        `Please run npm ci in the current runtime environment. Original error: ${message}`
    );
  }
}

function parseArgs() {
  const raw = process.argv.slice(2);
  const command = raw[0] || "help";
  const options = raw.slice(1);
  return { command, options };
}

function hasFlag(options, name) {
  return options.includes(name);
}

function getOptionValue(options, name) {
  const index = options.indexOf(name);
  if (index === -1) return undefined;
  const value = options[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for option ${name}`);
  }
  return value;
}

function resolveInputString(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function createRandomPassword() {
  return crypto.randomBytes(18).toString("base64url");
}

function printHelp() {
  console.log(`${SCRIPT_PREFIX} Super Admin CLI`);
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/super-admin.js emails [--json]");
  console.log("  node scripts/super-admin.js reset-password [--email <email>] [--password <password>] [--json]");
  console.log("  node scripts/super-admin.js help");
  console.log("");
  console.log("Commands:");
  console.log("  emails          List all SUPER_ADMIN account emails");
  console.log("  reset-password  Reset SUPER_ADMIN password");
  console.log("");
  console.log("Notes:");
  console.log("  - If there are multiple SUPER_ADMIN accounts, reset-password requires --email.");
  console.log("  - If --password is not provided, a random password is generated and printed once.");
}

async function listSuperAdminEmails(prisma, useJson) {
  const superAdmins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN" },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (useJson) {
    console.log(
      JSON.stringify(
        {
          count: superAdmins.length,
          superAdmins,
        },
        null,
        2
      )
    );
    return;
  }

  if (superAdmins.length === 0) {
    console.log(`${SCRIPT_PREFIX} no SUPER_ADMIN accounts found`);
    return;
  }

  console.log(`${SCRIPT_PREFIX} found ${superAdmins.length} SUPER_ADMIN account(s):`);
  for (const admin of superAdmins) {
    console.log(`- ${admin.email}`);
  }
}

function normalizeEmailForLookup(value) {
  const trimmed = resolveInputString(value);
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
}

async function resolveTargetSuperAdmin(prisma, inputEmail) {
  const email = normalizeEmailForLookup(inputEmail);
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    if (user.role !== "SUPER_ADMIN") {
      throw new Error(`User ${email} is not a SUPER_ADMIN`);
    }

    return user;
  }

  const superAdmins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN" },
    select: { id: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  if (superAdmins.length === 0) {
    throw new Error("No SUPER_ADMIN accounts found");
  }

  if (superAdmins.length > 1) {
    const allEmails = superAdmins.map((item) => item.email).join(", ");
    throw new Error(`Multiple SUPER_ADMIN accounts found (${allEmails}). Please specify --email.`);
  }

  return superAdmins[0];
}

async function resetSuperAdminPassword(prisma, options) {
  const requestedEmail = getOptionValue(options, "--email");
  const providedPassword = resolveInputString(getOptionValue(options, "--password"));
  const useJson = hasFlag(options, "--json");

  const target = await resolveTargetSuperAdmin(prisma, requestedEmail);
  const nextPassword = providedPassword || createRandomPassword();

  if (nextPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const hashedPassword = await bcrypt.hash(nextPassword, 12);
  await prisma.user.update({
    where: { id: target.id },
    data: { password: hashedPassword },
  });

  const generated = !providedPassword;
  if (useJson) {
    console.log(
      JSON.stringify(
        {
          email: target.email,
          generated,
          password: generated ? nextPassword : undefined,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`${SCRIPT_PREFIX} password reset for SUPER_ADMIN: ${target.email}`);
  if (generated) {
    console.log(`${SCRIPT_PREFIX} generated password: ${nextPassword}`);
  }
}

async function run() {
  const { command, options } = parseArgs();
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command !== "emails" && command !== "reset-password") {
    throw new Error(`Unknown command: ${command}`);
  }

  const prisma = createPrismaClient();

  try {
    if (command === "emails") {
      await listSuperAdminEmails(prisma, hasFlag(options, "--json"));
      return;
    }

    await resetSuperAdminPassword(prisma, options);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${SCRIPT_PREFIX} ${message}`);
  process.exitCode = 1;
});
