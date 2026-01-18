import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  normalizeForwardRuleConfig,
  normalizeForwardTargetConfig,
  parseForwardRuleConfig,
} from "@/services/forward-config";
import { readJsonBody } from "@/lib/request";

const legacyCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["EMAIL", "TELEGRAM", "DISCORD", "SLACK", "WEBHOOK"]),
  config: z.string(),
  mailboxId: z.string().nullable().optional(),
});

const targetSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["EMAIL", "TELEGRAM", "DISCORD", "SLACK", "WEBHOOK"]),
  config: z.string(),
});

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  config: z.string().optional(),
  mailboxId: z.string().nullable().optional(),
  targets: z.array(targetSchema.omit({ id: true })).min(1, "At least one target is required"),
});

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await prisma.forwardRule.findMany({
    where: { userId: session.user.id },
    include: { mailbox: { select: { address: true } }, targets: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 200_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const body = bodyResult.data;
    if (body && typeof body === "object" && "targets" in body) {
      const data = createSchema.parse(body);

      if (typeof data.mailboxId === "string") {
        const mailbox = await prisma.mailbox.findFirst({
          where: { id: data.mailboxId, userId: session.user.id },
          select: { id: true },
        });
        if (!mailbox) {
          return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
        }
      }

      const ruleConfig = data.config ?? JSON.stringify({ version: 3 });
      const parsedConfig = parseForwardRuleConfig(ruleConfig);
      if (!parsedConfig.ok || parsedConfig.config.version !== 3) {
        return NextResponse.json(
          { error: parsedConfig.ok ? "Forward config version must be 3" : parsedConfig.error },
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
          config: ruleConfig,
          mailboxId: data.mailboxId ?? null,
          userId: session.user.id,
          targets: { create: normalizedTargets },
        },
        include: { mailbox: { select: { address: true } }, targets: true },
      });

      return NextResponse.json(rule);
    }

    const data = legacyCreateSchema.parse(body);

    if (typeof data.mailboxId === "string") {
      const mailbox = await prisma.mailbox.findFirst({
        where: { id: data.mailboxId, userId: session.user.id },
        select: { id: true },
      });
      if (!mailbox) {
        return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
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
        config: data.config,
        mailboxId: data.mailboxId ?? null,
        userId: session.user.id,
        targets: { create: { type: data.type, config: JSON.stringify(normalized.config.destination) } },
      },
      include: { mailbox: { select: { address: true } }, targets: true },
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
