import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowSchema } from "@/lib/workflow/schema";
import { createEmptyWorkflowConfig } from "@/lib/workflow/types";
import { readJsonBody } from "@/lib/request";
import { assertCanCreateWorkflow, assertUserGroupFeatureEnabled } from "@/services/usergroups/policy";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const feature = await assertUserGroupFeatureEnabled({ userId: session.user.id, feature: "workflow" });
    if (!feature.ok) {
      return NextResponse.json({ error: feature.error, code: feature.code, meta: feature.meta }, { status: feature.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const mailboxId = searchParams.get("mailboxId");

    const workflows = await prisma.workflow.findMany({
      where: {
        userId: session.user.id,
        ...(status && { status: status as "DRAFT" | "ACTIVE" | "INACTIVE" | "ERROR" }),
        ...(mailboxId && { mailboxId }),
      },
      include: {
        mailbox: {
          select: {
            id: true,
            address: true,
          },
        },
        _count: {
          select: {
            executions: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const workflowsWithLastExecution = await Promise.all(
      workflows.map(async (workflow) => {
        const lastExecution = await prisma.workflowExecution.findFirst({
          where: { workflowId: workflow.id },
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
          },
        });

        return {
          ...workflow,
          lastExecution,
        };
      })
    );

    return NextResponse.json(workflowsWithLastExecution);
  } catch (error) {
    console.error("Error fetching workflows:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflows" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const feature = await assertUserGroupFeatureEnabled({ userId: session.user.id, feature: "workflow" });
    if (!feature.ok) {
      return NextResponse.json({ error: feature.error, code: feature.code, meta: feature.meta }, { status: feature.status });
    }

    const quota = await assertCanCreateWorkflow(session.user.id);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error, code: quota.code, meta: quota.meta }, { status: quota.status });
    }

    const bodyResult = await readJsonBody(request, { maxBytes: 400_000 });
    if (!bodyResult.ok) {
      return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
    }
    const body = bodyResult.data;
    const parsed = createWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, mailboxId, config } = parsed.data;

    // Validate mailbox ownership if provided
    if (mailboxId) {
      const mailbox = await prisma.mailbox.findFirst({
        where: {
          id: mailboxId,
          userId: session.user.id,
        },
      });

      if (!mailbox) {
        return NextResponse.json(
          { error: "Mailbox not found" },
          { status: 404 }
        );
      }
    }

    const workflow = await prisma.workflow.create({
      data: {
        name,
        description: description || "",
        userId: session.user.id,
        mailboxId: mailboxId || null,
        config: JSON.stringify(config || createEmptyWorkflowConfig()),
        status: "DRAFT",
        version: 1,
      },
      include: {
        mailbox: {
          select: {
            id: true,
            address: true,
          },
        },
      },
    });

    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    console.error("Error creating workflow:", error);
    return NextResponse.json(
      { error: "Failed to create workflow" },
      { status: 500 }
    );
  }
}
