import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";

const daysSchema = z
  .number()
  .int()
  .min(-1)
  .max(3650)
  .refine((value) => value === -1 || value > 0, {
    message: "Days must be -1 (never) or a positive integer",
  });

const patchSchema = z.object({
  mailboxExpireDays: daysSchema,
  mailboxExpireAction: z.enum(["ARCHIVE", "DELETE"]),
  emailExpireDays: daysSchema,
  emailExpireAction: z.enum(["ARCHIVE", "DELETE"]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      mailboxExpireDays: true,
      mailboxExpireAction: true,
      emailExpireDays: true,
      emailExpireAction: true,
    },
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

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        mailboxExpireDays: true,
        mailboxExpireAction: true,
        emailExpireDays: true,
        emailExpireAction: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Update retention settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
