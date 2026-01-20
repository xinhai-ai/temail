import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSystemSettingValue } from "@/services/system-settings";

function normalizeOrigin(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

async function getPublicBaseUrl(): Promise<string> {
  const configured = normalizeOrigin(await getSystemSettingValue("site_url"));
  const fallback =
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeOrigin(process.env.AUTH_URL) ||
    "http://localhost:3000";

  return (configured || fallback).replace(/\/+$/, "");
}

async function buildPreviewUrl(token: string): Promise<string> {
  return `${await getPublicBaseUrl()}/p/${token}`;
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
      return { token: row.token, url: await buildPreviewUrl(row.token) };
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
