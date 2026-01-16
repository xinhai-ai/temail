import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import {
  normalizeForwardRuleConfig,
  normalizeForwardTargetConfig,
  parseForwardRuleConfig,
} from "@/services/forward-config";

const targetSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["EMAIL", "TELEGRAM", "DISCORD", "SLACK", "WEBHOOK"]),
  config: z.string(),
});

const updateSchema = z.object({
  name: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ERROR"]).optional(),
  config: z.string().optional(),
  mailboxId: z.string().nullable().optional(),
  targets: z.array(targetSchema).min(1).optional(),
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

  const rule = await prisma.forwardRule.findUnique({
    where: { id },
    include: {
      mailbox: true,
      targets: true,
      logs: { take: 20, orderBy: { createdAt: "desc" }, include: { target: true } },
    },
  });

  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json(rule);
}

export async function PATCH(
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
    const data = updateSchema.parse(body);

    if (data.mailboxId) {
      const mailbox = await prisma.mailbox.findUnique({
        where: { id: data.mailboxId },
        select: { id: true },
      });
      if (!mailbox) {
        return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
      }
    }

    const existing = await prisma.forwardRule.findUnique({ where: { id }, include: { targets: true } });
    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const ruleUpdate: {
      name?: string;
      status?: "ACTIVE" | "INACTIVE" | "ERROR";
      config?: string;
      mailboxId?: string | null;
      type?: "EMAIL" | "TELEGRAM" | "DISCORD" | "SLACK" | "WEBHOOK";
    } = {};
    if (typeof data.name === "string") ruleUpdate.name = data.name;
    if (typeof data.status === "string") ruleUpdate.status = data.status;
    if (typeof data.mailboxId !== "undefined") ruleUpdate.mailboxId = data.mailboxId ?? null;

    if (typeof data.config === "string") {
      const parsed = parseForwardRuleConfig(data.config);
      if (parsed.ok) {
        ruleUpdate.config = data.config;
      } else {
        const normalized = normalizeForwardRuleConfig(existing.type, data.config);
        if (!normalized.ok) {
          return NextResponse.json({ error: normalized.error }, { status: 400 });
        }
        ruleUpdate.config = data.config;
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(ruleUpdate).length > 0) {
        await tx.forwardRule.update({ where: { id: existing.id }, data: ruleUpdate });
      }

      if (data.targets) {
        const normalizedTargets = data.targets.map((t) => {
          const normalized = normalizeForwardTargetConfig(t.type, t.config);
          if (!normalized.ok) throw new Error(normalized.error);
          return { ...t, config: JSON.stringify(normalized.destination) };
        });

        const keepIds = new Set(normalizedTargets.map((t) => t.id).filter(Boolean) as string[]);

        for (const t of normalizedTargets) {
          if (t.id && existing.targets.some((et) => et.id === t.id)) {
            await tx.forwardTarget.update({
              where: { id: t.id },
              data: { type: t.type, config: t.config },
            });
            continue;
          }
          await tx.forwardTarget.create({
            data: { ruleId: existing.id, type: t.type, config: t.config },
          });
        }

        const toDelete = existing.targets.filter((t) => !keepIds.has(t.id)).map((t) => t.id);
        if (toDelete.length > 0) {
          await tx.forwardTarget.deleteMany({ where: { id: { in: toDelete } } });
        }

        if (normalizedTargets.length > 0) {
          await tx.forwardRule.update({ where: { id: existing.id }, data: { type: normalizedTargets[0].type } });
        }
      }
    });

    const updated = await prisma.forwardRule.findUnique({ where: { id }, include: { targets: true } });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.forwardRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
