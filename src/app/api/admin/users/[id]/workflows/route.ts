import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const workflows = await prisma.workflow.findMany({
    where: { userId: id },
    include: {
      mailbox: { select: { id: true, address: true } },
      _count: { select: { executions: true, dispatchLogs: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(workflows);
}

