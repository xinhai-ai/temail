import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession, isSuperAdminRole } from "@/lib/rbac";

const schema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(
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
      { error: "Only SUPER_ADMIN can reset admin passwords" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const data = schema.parse(body);
    const hashedPassword = await bcrypt.hash(data.password, 12);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");
    await prisma.log.create({
      data: {
        level: "WARN",
        action: "USER_UPDATE",
        message: `Admin reset password for user ${id}`,
        metadata: JSON.stringify({ targetUserId: id }),
        ip: ip || null,
        userAgent: userAgent || null,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

