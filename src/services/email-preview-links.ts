import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

function getPublicBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
  return raw.trim().replace(/\/+$/, "");
}

function buildPreviewUrl(token: string) {
  return `${getPublicBaseUrl()}/p/${token}`;
}

function generateToken() {
  return crypto.randomBytes(9).toString("base64url");
}

function isMissingTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("no such table: email_preview_links");
}

export async function getOrCreateEmailPreviewLink(emailId: string): Promise<{ token: string; url: string } | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateToken();
    try {
      const row = await prisma.emailPreviewLink.upsert({
        where: { emailId },
        update: {},
        create: { emailId, token },
        select: { token: true },
      });
      return { token: row.token, url: buildPreviewUrl(row.token) };
    } catch (error) {
      if (isMissingTableError(error)) return null;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }
  return null;
}

