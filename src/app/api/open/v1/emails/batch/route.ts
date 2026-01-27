import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";
import { getRestoreStatusForTrash } from "@/services/email-trash";

const BATCH_LIMIT = 100;

const batchSchema = z.object({
  operation: z.enum([
    "mark_read",
    "mark_unread",
    "archive",
    "delete",
    "restore",
    "star",
    "unstar",
  ]),
  emailIds: z.array(z.string().min(1)).min(1).max(BATCH_LIMIT),
});

export async function POST(request: NextRequest) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "emails:write" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 50_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = batchSchema.parse(bodyResult.data);

    const ownedEmails = await prisma.email.findMany({
      where: {
        id: { in: data.emailIds },
        mailbox: { userId: authResult.apiKey.userId },
      },
      select: { id: true, status: true },
    });

    const ownedIds = ownedEmails.map((e) => e.id);

    if (ownedIds.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        failed: data.emailIds.length,
      });
    }

    let processed = 0;

    switch (data.operation) {
      case "mark_read":
        processed = (await prisma.email.updateMany({
          where: { id: { in: ownedIds }, status: { not: "READ" } },
          data: { status: "READ" },
        })).count;
        break;

      case "mark_unread":
        processed = (await prisma.email.updateMany({
          where: { id: { in: ownedIds }, status: { not: "UNREAD" } },
          data: { status: "UNREAD" },
        })).count;
        break;

      case "archive":
        processed = (await prisma.email.updateMany({
          where: { id: { in: ownedIds }, status: { not: "ARCHIVED" } },
          data: { status: "ARCHIVED" },
        })).count;
        break;

      case "delete": {
        const now = new Date();
        const toDelete = ownedEmails.filter((e) => e.status !== "DELETED");
        for (const email of toDelete) {
          await prisma.email.update({
            where: { id: email.id },
            data: {
              status: "DELETED",
              deletedAt: now,
              restoreStatus: getRestoreStatusForTrash(email.status),
            },
          });
        }
        processed = toDelete.length;
        break;
      }

      case "restore": {
        const toRestore = ownedEmails.filter((e) => e.status === "DELETED");
        for (const email of toRestore) {
          const restoreEmail = await prisma.email.findUnique({
            where: { id: email.id },
            select: { restoreStatus: true },
          });
          const newStatus = restoreEmail?.restoreStatus === "UNREAD" ? "UNREAD" : "READ";
          await prisma.email.update({
            where: { id: email.id },
            data: { status: newStatus, deletedAt: null, restoreStatus: null },
          });
        }
        processed = toRestore.length;
        break;
      }

      case "star":
        processed = (await prisma.email.updateMany({
          where: { id: { in: ownedIds }, isStarred: false },
          data: { isStarred: true },
        })).count;
        break;

      case "unstar":
        processed = (await prisma.email.updateMany({
          where: { id: { in: ownedIds }, isStarred: true },
          data: { isStarred: false },
        })).count;
        break;
    }

    return NextResponse.json({
      success: true,
      processed,
      failed: data.emailIds.length - ownedIds.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[open/v1/emails/batch] operation failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
