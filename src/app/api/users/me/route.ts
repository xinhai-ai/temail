import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { readJsonBody } from "@/lib/request";

const patchSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80, "Name is too long")
    .nullable()
    .optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, role: true, createdAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 10_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = patchSchema.parse(bodyResult.data);
    const nextName = typeof data.name === "string" ? data.name.trim() : data.name;
    const name = nextName ? nextName : null;

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { name },
      select: { email: true, name: true },
    });

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");
    await prisma.log.create({
      data: {
        level: "INFO",
        action: "USER_UPDATE",
        message: `User updated profile`,
        metadata: JSON.stringify({ userId: session.user.id }),
        ip: ip || null,
        userAgent: userAgent || null,
        userId: session.user.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

