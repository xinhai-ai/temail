import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [user, totp, passkeyCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { id: true },
    }),
    prisma.userTotp.findUnique({
      where: { userId: id },
      select: { enabledAt: true },
    }),
    prisma.passkeyCredential.count({ where: { userId: id } }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    otpEnabled: Boolean(totp?.enabledAt),
    passkeyCount,
  });
}

