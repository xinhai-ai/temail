import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishRealtimeEvent } from "@/lib/realtime/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";

const updateSchema = z.object({
  status: z.enum(["UNREAD", "READ", "ARCHIVED", "DELETED"]).optional(),
  isStarred: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: session.user.id } },
    include: {
      mailbox: true,
      attachments: {
        select: {
          id: true,
          filename: true,
          contentType: true,
          size: true,
        },
      },
      headers: true,
      emailTags: {
        select: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // For lazy loading: exclude rawContent from response, but indicate if it's available
  // - If rawContentPath exists: raw content is in file storage
  // - If only rawContent exists (legacy): keep a flag so frontend knows raw is available
  const { rawContent, emailTags, ...emailWithoutRawContent } = email;
  const response = {
    ...emailWithoutRawContent,
    tags: emailTags.map((et) => et.tag),
    // For backward compatibility: if no rawContentPath but rawContent exists,
    // set rawContent to true (as a flag) so frontend knows to fetch from /raw
    rawContent: !email.rawContentPath && rawContent ? true : undefined,
  };

  if (email.status === "UNREAD") {
    await prisma.email.update({
      where: { id },
      data: { status: "READ" },
    });

    publishRealtimeEvent(session.user.id, {
      type: "email.updated",
      data: { id, mailboxId: email.mailboxId, status: "READ" },
    });

    return NextResponse.json({ ...response, status: "READ" });
  }

  return NextResponse.json(response);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = updateSchema.parse(bodyResult.data);

    const email = await prisma.email.findFirst({
      where: { id, mailbox: { userId: session.user.id } },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const updated = await prisma.email.update({
      where: { id },
      data,
    });

    publishRealtimeEvent(session.user.id, {
      type: "email.updated",
      data: {
        id: updated.id,
        mailboxId: updated.mailboxId,
        ...(data.status ? { status: data.status } : {}),
        ...(typeof data.isStarred === "boolean" ? { isStarred: data.isStarred } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: session.user.id } },
  });

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  await prisma.email.delete({ where: { id } });

  publishRealtimeEvent(session.user.id, {
    type: "email.deleted",
    data: { id, mailboxId: email.mailboxId },
  });

  return NextResponse.json({ success: true });
}
