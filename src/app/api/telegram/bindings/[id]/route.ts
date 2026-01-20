import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { deleteTelegramNotifyWorkflowForBinding } from "@/services/telegram/notify-workflows";

const patchSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await prisma.telegramChatBinding.findFirst({
    where: { id, userId: session.user.id, mode: "MANAGE" },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Binding not found" }, { status: 404 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 10_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  const parsed = patchSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.telegramChatBinding.updateMany({
    where: { id, userId: session.user.id, mode: "MANAGE" },
    data: { enabled: parsed.data.enabled },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Binding not found" }, { status: 404 });
  }

  // Legacy cleanup: notifications are now configured explicitly via workflow nodes.
  await deleteTelegramNotifyWorkflowForBinding(id);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const binding = await prisma.telegramChatBinding.findFirst({
    where: { id, userId: session.user.id, mode: "MANAGE" },
    select: { id: true, chatId: true },
  });
  if (!binding) {
    return NextResponse.json({ error: "Binding not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.telegramChatBinding.deleteMany({
      where: { userId: session.user.id, chatId: binding.chatId, mode: "NOTIFY" },
    }),
    prisma.telegramChatBinding.delete({
      where: { id: binding.id },
    }),
  ]);

  await deleteTelegramNotifyWorkflowForBinding(binding.id);

  return NextResponse.json({ success: true });
}
