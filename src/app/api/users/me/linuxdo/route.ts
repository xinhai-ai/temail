import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function linuxDoAvatarUrl(avatarTemplate: string | null, size: number): string | null {
  const template = (avatarTemplate || "").trim();
  if (!template) return null;

  const replaced = template.replaceAll("{size}", String(size));
  if (replaced.startsWith("https://") || replaced.startsWith("http://")) return replaced;
  if (replaced.startsWith("//")) return `https:${replaced}`;
  if (replaced.startsWith("/")) return `https://connect.linux.do${replaced}`;
  return replaced;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const link = await prisma.linuxDoUserLink.findUnique({
    where: { userId: session.user.id },
    select: {
      linuxdoId: true,
      username: true,
      name: true,
      avatarTemplate: true,
      trustLevel: true,
      active: true,
      silenced: true,
      lastSyncedAt: true,
    },
  });

  if (!link) {
    return NextResponse.json({ linked: false });
  }

  return NextResponse.json({
    linked: true,
    linuxdo: {
      id: link.linuxdoId,
      username: link.username,
      name: link.name,
      trustLevel: link.trustLevel,
      active: link.active,
      silenced: link.silenced,
      avatarUrl: linuxDoAvatarUrl(link.avatarTemplate, 120),
      lastSyncedAt: link.lastSyncedAt,
    },
  });
}

