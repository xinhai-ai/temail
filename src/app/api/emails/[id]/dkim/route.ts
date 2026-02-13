import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getCacheNamespace } from "@/lib/cache";
import { verifyDkim, type DkimUiResult } from "@/lib/email/dkim";
import { isVercelDeployment } from "@/lib/deployment/server";

const DKIM_CACHE_TTL_MS = 5 * 60_000;
const dkimCache = getCacheNamespace("dkim");
const dkimInFlight = new Map<string, Promise<DkimUiResult>>();

function buildCacheControl() {
  const maxAge = Math.floor(DKIM_CACHE_TTL_MS / 1000);
  const stale = Math.min(60 * 60, maxAge);
  return `private, max-age=${maxAge}, stale-while-revalidate=${stale}`;
}

async function getCachedDkim(emailId: string): Promise<DkimUiResult | null> {
  const cached = await dkimCache.getJson<{ value: DkimUiResult }>(emailId);
  return cached?.value ?? null;
}

async function setCachedDkim(emailId: string, value: DkimUiResult) {
  await dkimCache.setJson(emailId, { value }, { ttlMs: DKIM_CACHE_TTL_MS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isVercelDeployment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cached = await getCachedDkim(id);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": buildCacheControl() },
    });
  }

  const existing = dkimInFlight.get(id);
  if (existing) {
    try {
      const value = await existing;
      return NextResponse.json(value, {
        headers: { "Cache-Control": buildCacheControl() },
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Email not found") {
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  const promise = (async () => {
    const email = await prisma.email.findFirst({
      where: { id, mailbox: { userId: session.user.id } },
      select: { id: true, rawContent: true, rawContentPath: true, rawStorageBackend: true },
    });

    if (!email) {
      throw new Error("Email not found");
    }

    const value = await verifyDkim(email);
    await setCachedDkim(id, value);
    return value;
  })()
    .finally(() => {
      dkimInFlight.delete(id);
    });

  dkimInFlight.set(id, promise);

  try {
    const value = await promise;
    return NextResponse.json(value, {
      headers: { "Cache-Control": buildCacheControl() },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Email not found") {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
