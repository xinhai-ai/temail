import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishRealtimeEvent } from "@/lib/realtime/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { getRestoreStatusForTrash, moveOwnedEmailToTrash } from "@/services/email-trash";
import { Prisma } from "@prisma/client";
import { isVercelDeployment } from "@/lib/deployment/server";

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

  const vercelMode = isVercelDeployment();

  // For lazy loading: exclude rawContent from response, but indicate if it's available
  // - If rawContentPath exists: raw content is in file storage
  // - If only rawContent exists (legacy): keep a flag so frontend knows raw is available
  const { rawContent, rawContentPath, emailTags, storageBytes, storageFiles, storageTruncated, ...emailWithoutRawContent } = email;
  const response = {
    ...emailWithoutRawContent,
    tags: emailTags.map((et) => et.tag),
    storageBytes,
    storageFiles,
    storageTruncated,
    ...(vercelMode ? {} : { rawContentPath }),
    // For backward compatibility: if no rawContentPath but rawContent exists,
    // set rawContent to true (as a flag) so frontend knows to fetch from /raw
    rawContent: vercelMode ? undefined : !rawContentPath && rawContent ? true : undefined,
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

    const updateData: Prisma.EmailUpdateInput = {};

    if (typeof data.isStarred === "boolean") {
      updateData.isStarred = data.isStarred;
    }

    if (data.status) {
      if (data.status === "DELETED") {
        if (email.status !== "DELETED") {
          updateData.status = "DELETED";
          updateData.deletedAt = email.deletedAt ?? new Date();
          updateData.restoreStatus = getRestoreStatusForTrash(email.status);
        }
      } else {
        updateData.status = data.status;
        if (email.status === "DELETED") {
          updateData.deletedAt = null;
          updateData.restoreStatus = null;
        }
      }
    }

    const updated = await prisma.email.update({
      where: { id },
      data: updateData,
    });

    publishRealtimeEvent(session.user.id, {
      type: "email.updated",
      data: {
        id: updated.id,
        mailboxId: updated.mailboxId,
        ...(data.status ? { status: updated.status } : {}),
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

  const moved = await moveOwnedEmailToTrash({ emailId: id, userId: session.user.id });
  if (!moved) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  publishRealtimeEvent(session.user.id, {
    type: "email.updated",
    data: { id, mailboxId: moved.mailboxId, status: "DELETED" },
  });

  return NextResponse.json({ success: true });
}
