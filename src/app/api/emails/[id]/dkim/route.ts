import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { verifyDkim, type DkimUiResult } from "@/lib/email/dkim";

const DKIM_CACHE_TTL_MS = 5 * 60_000;
const DKIM_CACHE_MAX_ENTRIES = 500;
const dkimCache = new Map<string, { expiresAt: number; value: DkimUiResult }>();

function getCachedDkim(emailId: string): DkimUiResult | null {
  const now = Date.now();
  const cached = dkimCache.get(emailId);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    dkimCache.delete(emailId);
    return null;
  }
  return cached.value;
}

function setCachedDkim(emailId: string, value: DkimUiResult) {
  const now = Date.now();
  dkimCache.set(emailId, { expiresAt: now + DKIM_CACHE_TTL_MS, value });

  if (dkimCache.size <= DKIM_CACHE_MAX_ENTRIES) return;

  // Best-effort prune: remove expired entries first, otherwise drop oldest.
  for (const [key, entry] of dkimCache) {
    if (entry.expiresAt <= now) dkimCache.delete(key);
  }
  while (dkimCache.size > DKIM_CACHE_MAX_ENTRIES) {
    const firstKey = dkimCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    dkimCache.delete(firstKey);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cached = getCachedDkim(id);
  if (cached) return NextResponse.json(cached);

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: session.user.id } },
    select: { id: true, rawContent: true },
  });

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const value = await verifyDkim(email.rawContent);
  setCachedDkim(id, value);
  return NextResponse.json(value);
}

