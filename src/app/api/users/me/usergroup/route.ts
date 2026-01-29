import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      userGroup: {
        select: {
          id: true,
          name: true,
          maxMailboxes: true,
          maxWorkflows: true,
          telegramEnabled: true,
          workflowEnabled: true,
          workflowForwardEmailEnabled: true,
          openApiEnabled: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [mailboxes, workflows] = await Promise.all([
    prisma.mailbox.count({
      where: { userId: session.user.id, status: { not: "DELETED" } },
    }),
    prisma.workflow.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({
    userGroup: user.userGroup,
    usage: { mailboxes, workflows },
  });
}

