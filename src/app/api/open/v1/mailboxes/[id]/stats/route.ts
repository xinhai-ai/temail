import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "mailboxes:read" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const mailbox = await prisma.mailbox.findFirst({
    where: { id, userId: authResult.apiKey.userId },
    select: { id: true },
  });

  if (!mailbox) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  const [statusCounts, starredCount, latestEmail] = await Promise.all([
    prisma.email.groupBy({
      by: ["status"],
      where: { mailboxId: id },
      _count: { id: true },
    }),
    prisma.email.count({
      where: { mailboxId: id, isStarred: true },
    }),
    prisma.email.findFirst({
      where: { mailboxId: id },
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true },
    }),
  ]);

  const countByStatus = new Map(
    statusCounts.map((item) => [item.status, item._count.id])
  );

  const unreadCount = countByStatus.get("UNREAD") ?? 0;
  const readCount = countByStatus.get("READ") ?? 0;
  const archivedCount = countByStatus.get("ARCHIVED") ?? 0;
  const deletedCount = countByStatus.get("DELETED") ?? 0;
  const totalEmails = unreadCount + readCount + archivedCount + deletedCount;

  return NextResponse.json({
    stats: {
      totalEmails,
      unreadCount,
      readCount,
      archivedCount,
      deletedCount,
      starredCount,
      latestEmailAt: latestEmail?.receivedAt ?? null,
    },
  });
}
