import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateWorkflowSchema, validateWorkflowConfig } from "@/lib/workflow/schema";
import { validateWorkflow } from "@/lib/workflow/utils";
import { readJsonBody } from "@/lib/request";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        userId: session.user.id,
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
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("Error fetching workflow:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const bodyResult = await readJsonBody(request, { maxBytes: 400_000 });
    if (!bodyResult.ok) {
      return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
    }
    const body = bodyResult.data;
    const parsed = updateWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, status, mailboxId, config } = parsed.data;

    const nextStatus = status ?? workflow.status;
    if (nextStatus === "ACTIVE") {
      const configCandidate = config ?? (() => {
        try {
          return JSON.parse(workflow.config) as unknown;
        } catch {
          return null;
        }
      })();

      const cfgParse = validateWorkflowConfig(configCandidate);
      if (!cfgParse.success) {
        return NextResponse.json({ error: "Invalid workflow config" }, { status: 400 });
      }

      const checks = validateWorkflow(cfgParse.data);
      const errors = checks.filter((e) => e.type === "error");
      if (errors.length > 0) {
        return NextResponse.json({ error: "Workflow config is not executable", details: errors }, { status: 400 });
      }
    }

    // Validate mailbox ownership if provided
    if (mailboxId !== undefined && mailboxId !== null) {
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

    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(mailboxId !== undefined && { mailboxId }),
        ...(config !== undefined && { config: JSON.stringify(config) }),
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating workflow:", error);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    await prisma.workflow.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting workflow:", error);
    return NextResponse.json(
      { error: "Failed to delete workflow" },
      { status: 500 }
    );
  }
}
