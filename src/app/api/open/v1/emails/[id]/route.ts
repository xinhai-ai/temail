import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";
import { isVercelDeployment } from "@/lib/deployment/server";
import { moveOwnedEmailToTrash } from "@/services/email-trash";

const patchSchema = z.object({
  status: z.enum(["UNREAD", "READ", "ARCHIVED", "DELETED"]).optional(),
  isStarred: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "emails:read" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: authResult.apiKey.userId } },
    include: {
      mailbox: { select: { id: true, address: true } },
      attachments: {
        select: {
          id: true,
          filename: true,
          contentType: true,
          size: true,
        },
      },
      headers: { select: { name: true, value: true } },
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
  const rawAvailable = !vercelMode && Boolean(email.rawContentPath || email.rawContent);
  const { rawContent, rawContentPath, emailTags, ...rest } = email;

  return NextResponse.json({
    email: {
      ...rest,
      tags: emailTags.map((et) => et.tag),
      rawAvailable,
      rawContentPath: vercelMode ? undefined : rawContentPath,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "emails:write" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = patchSchema.parse(bodyResult.data);

    const email = await prisma.email.findFirst({
      where: { id, mailbox: { userId: authResult.apiKey.userId } },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    if (data.status === "DELETED") {
      const moved = await moveOwnedEmailToTrash({ emailId: id, userId: authResult.apiKey.userId });
      if (!moved) {
        return NextResponse.json({ error: "Email not found" }, { status: 404 });
      }

      const updated = await prisma.email.findUnique({
        where: { id },
        select: { id: true, status: true, deletedAt: true, restoreStatus: true, isStarred: true, mailboxId: true },
      });
      return NextResponse.json({ email: updated });
    }

    const updateData: Prisma.EmailUpdateInput = {};

    if (typeof data.isStarred === "boolean") {
      updateData.isStarred = data.isStarred;
    }

    if (data.status) {
      updateData.status = data.status;
      if (email.status === "DELETED") {
        updateData.deletedAt = null;
        updateData.restoreStatus = null;
      }
    }

    const updated = await prisma.email.update({
      where: { id },
      data: updateData,
      select: { id: true, status: true, deletedAt: true, restoreStatus: true, isStarred: true, mailboxId: true },
    });

    return NextResponse.json({ email: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[open/v1/emails] update failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "emails:write" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const moved = await moveOwnedEmailToTrash({ emailId: id, userId: authResult.apiKey.userId });
  if (!moved) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
