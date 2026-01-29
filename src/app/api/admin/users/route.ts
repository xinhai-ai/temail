import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      userGroupId: true,
      userGroup: { select: { id: true, name: true } },
      createdAt: true,
      _count: { select: { mailboxes: true, domains: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}
