import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";

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

  const secretKeys = new Set(["smtp_pass"]);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

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
