import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import { readJsonBody } from "@/lib/request";

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  type: z.string().optional(),
  description: z.string().nullable().optional(),
});

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  const secretKeys = new Set([
    "smtp_pass",
    "ai_classifier_api_key",
    "ai_rewrite_api_key",
    "turnstile_secret_key",
    "telegram_bot_token",
    "telegram_webhook_secret",
  ]);
  const safeSettings = settings.map((row) =>
    secretKeys.has(row.key)
      ? { ...row, value: "", masked: Boolean(row.value) }
      : row
  );

  return NextResponse.json(safeSettings);
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 200_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }
  const body = bodyResult.data;

  try {
    const items = Array.isArray(body) ? body : [body];
    const data = items.map((item) => settingSchema.parse(item));

    const results = await prisma.$transaction(
      data.map((item) =>
        prisma.systemSetting.upsert({
          where: { key: item.key },
          update: {
            value: item.value,
            type: item.type,
            description: item.description === undefined ? undefined : item.description,
          },
          create: {
            key: item.key,
            value: item.value,
            type: item.type,
            description: item.description ?? undefined,
          },
        })
      )
    );

    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
