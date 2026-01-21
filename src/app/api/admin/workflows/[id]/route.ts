import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { readJsonBody } from "@/lib/request";
import { validateWorkflowConfig } from "@/lib/workflow/schema";
import { validateWorkflow } from "@/lib/workflow/utils";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = updateSchema.parse(bodyResult.data);

    if (data.status === "ACTIVE") {
      const workflow = await prisma.workflow.findUnique({
        where: { id },
        select: { config: true },
      });
      if (!workflow) {
        return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
      }

      const config = (() => {
        try {
          return JSON.parse(workflow.config) as unknown;
        } catch {
          return null;
        }
      })();

      const cfgParse = validateWorkflowConfig(config);
      if (!cfgParse.success) {
        return NextResponse.json({ error: "Invalid workflow config" }, { status: 400 });
      }

      const checks = validateWorkflow(cfgParse.data);
      const errors = checks.filter((e) => e.type === "error");
      if (errors.length > 0) {
        return NextResponse.json({ error: "Workflow config is not executable", details: errors }, { status: 400 });
      }
    }

    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        ...(typeof data.name === "string" ? { name: data.name } : {}),
        ...(typeof data.status === "string" ? { status: data.status } : {}),
      },
      include: { mailbox: { select: { id: true, address: true } }, _count: { select: { executions: true, dispatchLogs: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
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
    await prisma.workflow.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
