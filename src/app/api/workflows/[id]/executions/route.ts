import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // Verify workflow ownership
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");

    const executions = await prisma.workflowExecution.findMany({
      where: {
        workflowId: id,
        ...(status && { status: status as "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED" }),
      },
      orderBy: {
        startedAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.workflowExecution.count({
      where: {
        workflowId: id,
        ...(status && { status: status as "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED" }),
      },
    });

    return NextResponse.json({
      executions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching workflow executions:", error);
    return NextResponse.json(
      { error: "Failed to fetch executions" },
      { status: 500 }
    );
  }
}
