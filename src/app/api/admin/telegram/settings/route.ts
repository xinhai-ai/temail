import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import { readJsonBody } from "@/lib/request";
import { clearSystemSettingCache } from "@/services/system-settings";

const TELEGRAM_SETTING_KEYS = [
  "telegram_bot_token",
  "telegram_bot_username",
  "telegram_webhook_secret",
  "telegram_forum_general_topic_name",
] as const;

const secretKeys = new Set(["telegram_bot_token", "telegram_webhook_secret"]);

const putSchema = z.array(
  z.object({
    key: z.string().min(1),
    value: z.string(),
  })
);

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...TELEGRAM_SETTING_KEYS] } },
    select: { key: true, value: true },
    orderBy: { key: "asc" },
  });

  const map = new Map(rows.map((r) => [r.key, r.value]));

  const envFallbacks: Record<string, string | undefined> = {
    telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN,
    telegram_bot_username: process.env.TELEGRAM_BOT_USERNAME,
    telegram_webhook_secret: process.env.TELEGRAM_WEBHOOK_SECRET,
  };

  const result = TELEGRAM_SETTING_KEYS.map((key) => {
    const raw = map.get(key) ?? "";
    const envRaw = envFallbacks[key];

    if (secretKeys.has(key)) {
      const configured = Boolean(raw.trim() || (envRaw || "").trim());
      return { key, value: "", masked: configured };
    }

    const value = raw || (envRaw || "");
    return { key, value, masked: false };
  });

  return NextResponse.json(result);
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 50_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  const parsed = putSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }

  const allowed = new Set<string>(TELEGRAM_SETTING_KEYS);
  const items = parsed.data.filter((item) => allowed.has(item.key));
  if (items.length === 0) {
    return NextResponse.json({ error: "No valid keys" }, { status: 400 });
  }

  const updates = items.filter((item) => !secretKeys.has(item.key) || Boolean(item.value.trim()));

  await prisma.$transaction(
    updates.map((item) =>
      prisma.systemSetting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value },
      })
    )
  );

  for (const item of updates) clearSystemSettingCache(item.key);

  return NextResponse.json({ success: true });
}

