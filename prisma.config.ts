import { defineConfig } from "prisma/config";

function detectProvider(): "postgresql" | "sqlite" {
  const url = process.env["DATABASE_URL"] || "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgresql";
  }
  return "sqlite";
}

const provider = detectProvider();

export default defineConfig({
  schema: provider === "postgresql" ? "prisma/schema-pg.prisma" : "prisma/schema.prisma",
  migrations: {
    path: provider === "postgresql" ? "prisma/migrations-pg" : "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] || "file:./dev.db",
  },
});
