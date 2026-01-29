import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import { readJsonBody } from "@/lib/request";
import { DEFAULT_USERGROUP_NAME } from "@/services/usergroups/default-group";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  domainPolicy: z.enum(["ALL_PUBLIC", "ALLOWLIST"]).optional(),
  maxMailboxes: z.number().int().min(0).nullable().optional(),
  maxWorkflows: z.number().int().min(0).nullable().optional(),
  telegramEnabled: z.boolean().optional(),
  workflowEnabled: z.boolean().optional(),
  workflowForwardEmailEnabled: z.boolean().optional(),
  openApiEnabled: z.boolean().optional(),
  domainIds: z.array(z.string().trim().min(1)).max(10_000).optional(),
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

  const group = await prisma.userGroup.findUnique({
    where: { id },
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
      openApiEnabled: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { users: true, domains: true } },
      domains: { select: { domainId: true }, orderBy: { domainId: "asc" } },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "User group not found" }, { status: 404 });
  }

  const domainIds = group.domains.map((d) => d.domainId);
  const { domains, ...rest } = group;
  return NextResponse.json({ group: { ...rest, domainIds } });
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

  const bodyResult = await readJsonBody(request, { maxBytes: 100_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = patchSchema.parse(bodyResult.data);
    const domainIds = Array.isArray(data.domainIds) ? Array.from(new Set(data.domainIds)) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const group = await tx.userGroup.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.domainPolicy !== undefined && { domainPolicy: data.domainPolicy }),
          ...(data.maxMailboxes !== undefined && { maxMailboxes: data.maxMailboxes }),
          ...(data.maxWorkflows !== undefined && { maxWorkflows: data.maxWorkflows }),
          ...(data.telegramEnabled !== undefined && { telegramEnabled: data.telegramEnabled }),
          ...(data.workflowEnabled !== undefined && { workflowEnabled: data.workflowEnabled }),
          ...(data.workflowForwardEmailEnabled !== undefined && { workflowForwardEmailEnabled: data.workflowForwardEmailEnabled }),
          ...(data.openApiEnabled !== undefined && { openApiEnabled: data.openApiEnabled }),
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
          openApiEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (domainIds !== undefined) {
        // Delete all existing domain associations and recreate
        await tx.userGroupDomain.deleteMany({ where: { userGroupId: id } });
        if (domainIds.length > 0) {
          await tx.userGroupDomain.createMany({
            data: domainIds.map((domainId) => ({ userGroupId: id, domainId })),
          });
        }
      }

      const storedDomainIds = domainIds ?? (await tx.userGroupDomain.findMany({
        where: { userGroupId: id },
        select: { domainId: true },
        orderBy: { domainId: "asc" },
      })).map((row) => row.domainId);

      return { ...group, domainIds: storedDomainIds };
    });

    return NextResponse.json({ group: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
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

  const group = await prisma.userGroup.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!group) {
    return NextResponse.json({ error: "User group not found" }, { status: 404 });
  }

  if (group.name === DEFAULT_USERGROUP_NAME) {
    return NextResponse.json({ error: "Cannot delete the default user group" }, { status: 400 });
  }

  const userCount = await prisma.user.count({ where: { userGroupId: id } });
  if (userCount > 0) {
    return NextResponse.json({ error: "Cannot delete a user group that still has users" }, { status: 400 });
  }

  await prisma.userGroup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
