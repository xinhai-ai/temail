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
  const passkeys = await prisma.passkeyCredential.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      lastUsedAt: true,
      deviceType: true,
      backedUp: true,
    },
  });

  return NextResponse.json({ available: flags.passkeyEnabled, passkeys });
}
