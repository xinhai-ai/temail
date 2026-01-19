import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, isSuperAdminRole } from "@/lib/rbac";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isSuperAdmin = isSuperAdminRole(session.user.role);
  if (target.role !== "USER" && !isSuperAdmin) {
    return NextResponse.json(
      { error: "Only SUPER_ADMIN can reset admin passkeys" },
      { status: 403 }
    );
  }

  const removed = await prisma.passkeyCredential.deleteMany({
    where: { userId: id },
  });

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");
  await prisma.log.create({
    data: {
      level: "WARN",
      action: "USER_UPDATE",
      message: `Admin deleted passkeys for user ${id}`,
      metadata: JSON.stringify({ targetUserId: id, deleted: removed.count }),
      ip: ip || null,
      userAgent: userAgent || null,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ success: true, deleted: removed.count });
}

