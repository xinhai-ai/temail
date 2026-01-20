import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { createTelegramBindCode } from "@/services/telegram/bind-codes";

const requestSchema = z.object({
  ttlSeconds: z.coerce.number().int().positive().max(60 * 60).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  const parsed = requestSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }

  const { code, expiresAt } = await createTelegramBindCode({
    userId: session.user.id,
    purpose: "BIND_CHAT",
    ttlSeconds: parsed.data.ttlSeconds,
  });

  return NextResponse.json({
    code,
    expiresAt: expiresAt.toISOString(),
  });
}
