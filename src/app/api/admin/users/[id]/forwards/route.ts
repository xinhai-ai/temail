import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import {
  normalizeForwardRuleConfig,
  normalizeForwardTargetConfig,
  parseForwardRuleConfig,
} from "@/services/forward-config";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["EMAIL", "TELEGRAM", "DISCORD", "SLACK", "WEBHOOK"]),
  config: z.string(),
  mailboxId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ERROR"]).optional(),
});

const targetSchema = z.object({
  type: z.enum(["EMAIL", "TELEGRAM", "DISCORD", "SLACK", "WEBHOOK"]),
  config: z.string(),
});

const createV3Schema = z.object({
  name: z.string().min(1, "Name is required"),
  config: z.string().optional(),
  mailboxId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ERROR"]).optional(),
  targets: z.array(targetSchema).min(1, "At least one target is required"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rules = await prisma.forwardRule.findMany({
    where: { userId: id },
    include: { mailbox: { select: { id: true, address: true } }, targets: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rules);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    if (body && typeof body === "object" && "targets" in body) {
      const data = createV3Schema.parse(body);

      const ruleConfig = data.config ?? JSON.stringify({ version: 3 });
      const parsed = parseForwardRuleConfig(ruleConfig);
      if (!parsed.ok || parsed.config.version !== 3) {
        return NextResponse.json(
          { error: parsed.ok ? "Forward config version must be 3" : parsed.error },
          { status: 400 }
        );
      }

      const normalizedTargets = data.targets.map((t) => {
        const normalized = normalizeForwardTargetConfig(t.type, t.config);
        if (!normalized.ok) throw new Error(normalized.error);
        return { type: t.type, config: JSON.stringify(normalized.destination) };
      });

      const rule = await prisma.forwardRule.create({
        data: {
          name: data.name,
          type: normalizedTargets[0].type,
          status: data.status ?? "ACTIVE",
          config: ruleConfig,
          userId: id,
          mailboxId: data.mailboxId ?? null,
          targets: { create: normalizedTargets },
        },
      });

      return NextResponse.json(rule);
    }

    const data = createSchema.parse(body);

    if (data.mailboxId) {
      const mailbox = await prisma.mailbox.findFirst({
        where: { id: data.mailboxId, userId: id },
        select: { id: true },
      });
      if (!mailbox) {
        return NextResponse.json(
          { error: "Mailbox not found for this user" },
          { status: 404 }
        );
      }
    }

    const normalized = normalizeForwardRuleConfig(data.type, data.config);
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const rule = await prisma.forwardRule.create({
      data: {
        name: data.name,
        type: data.type,
        status: data.status ?? "ACTIVE",
        config: data.config,
        userId: id,
        mailboxId: data.mailboxId ?? null,
        targets: { create: { type: data.type, config: JSON.stringify(normalized.config.destination) } },
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
