import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import { readJsonBody } from "@/lib/request";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  domainPolicy: z.enum(["ALL_PUBLIC", "ALLOWLIST"]).optional(),
  maxMailboxes: z.number().int().min(0).nullable().optional(),
  maxWorkflows: z.number().int().min(0).nullable().optional(),
  telegramEnabled: z.boolean().optional(),
  workflowEnabled: z.boolean().optional(),
  workflowForwardEmailEnabled: z.boolean().optional(),
  workflowForwardWebhookEnabled: z.boolean().optional(),
  openApiEnabled: z.boolean().optional(),
  domainIds: z.array(z.string().trim().min(1)).max(10_000).optional(),
});

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await prisma.userGroup.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      domainPolicy: true,
      maxMailboxes: true,
      maxWorkflows: true,
      telegramEnabled: true,
      workflowEnabled: true,
      workflowForwardEmailEnabled: true,
      workflowForwardWebhookEnabled: true,
      openApiEnabled: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { users: true, domains: true } },
    },
  });

  return NextResponse.json(groups);
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 100_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = createSchema.parse(bodyResult.data);
    const domainIds = Array.isArray(data.domainIds) ? Array.from(new Set(data.domainIds)) : [];

    const created = await prisma.$transaction(async (tx) => {
      const group = await tx.userGroup.create({
        data: {
          name: data.name,
          description: data.description === undefined ? undefined : data.description,
          domainPolicy: data.domainPolicy,
          maxMailboxes: data.maxMailboxes === undefined ? undefined : data.maxMailboxes,
          maxWorkflows: data.maxWorkflows === undefined ? undefined : data.maxWorkflows,
          telegramEnabled: data.telegramEnabled,
          workflowEnabled: data.workflowEnabled,
          workflowForwardEmailEnabled: data.workflowForwardEmailEnabled,
          workflowForwardWebhookEnabled: data.workflowForwardWebhookEnabled,
          openApiEnabled: data.openApiEnabled,
        },
        select: {
          id: true,
          name: true,
          description: true,
          domainPolicy: true,
          maxMailboxes: true,
          maxWorkflows: true,
          telegramEnabled: true,
          workflowEnabled: true,
          workflowForwardEmailEnabled: true,
          workflowForwardWebhookEnabled: true,
          openApiEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (domainIds.length > 0) {
        await tx.userGroupDomain.createMany({
          data: domainIds.map((domainId) => ({ userGroupId: group.id, domainId })),
        });
      }

      return group;
    });

    return NextResponse.json({ group: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
