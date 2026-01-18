import { PrismaClient } from "@prisma/client";

export type DatabaseType = "postgresql" | "sqlite";

function detectDatabaseType(): DatabaseType {
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgresql";
  }
  return "sqlite";
}

export const databaseType: DatabaseType = detectDatabaseType();

function createPrismaClient(): PrismaClient {
  if (databaseType === "postgresql") {
    // PostgreSQL with pg adapter
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    return new PrismaClient({ adapter });
  }
  // SQLite with libsql adapter
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaLibSql } = require("@prisma/adapter-libsql");
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
