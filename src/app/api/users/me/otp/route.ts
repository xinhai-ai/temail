import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getAuthFeatureFlags } from "@/lib/auth-features";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flags = await getAuthFeatureFlags();
  if (!flags.otpEnabled) {
    return NextResponse.json({ available: false, enabled: false });
  }

  const totp = await prisma.userTotp.findUnique({
    where: { userId: session.user.id },
    select: { enabledAt: true },
  });

  return NextResponse.json({ available: true, enabled: Boolean(totp?.enabledAt) });
}

