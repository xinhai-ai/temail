import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";
import {
  getSignedDownloadUrlByRecordStorage,
  isStorageFileNotFoundError,
  readStreamByRecordStorage,
} from "@/lib/storage/record-storage";

const SIGNED_URL_EXPIRES_SECONDS = 120;

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w\s.-]/g, "_").replace(/\s+/g, "_");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "emails:attachments" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id, attachmentId } = await params;

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: authResult.apiKey.userId } },
    select: {
      id: true,
      attachments: {
        where: { id: attachmentId },
        select: {
          id: true,
          filename: true,
          contentType: true,
          size: true,
          path: true,
          storageBackend: true,
        },
      },
    },
  });

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const attachment = email.attachments[0];
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const safeFilename = sanitizeFilename(attachment.filename);

  try {
    const signedUrl = await getSignedDownloadUrlByRecordStorage(
      attachment.path,
      attachment.storageBackend,
      {
        expiresInSeconds: SIGNED_URL_EXPIRES_SECONDS,
        responseContentType: attachment.contentType || "application/octet-stream",
        responseContentDisposition: `attachment; filename=\"${safeFilename}\"`,
      }
    );

    if (signedUrl) {
      return NextResponse.redirect(signedUrl, { status: 302 });
    }

    const stream = await readStreamByRecordStorage(attachment.path, attachment.storageBackend);

    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        stream.on("end", () => {
          controller.close();
        });
        stream.on("error", (err: Error) => {
          controller.error(err);
        });
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": attachment.contentType || "application/octet-stream",
        "Content-Length": String(attachment.size),
        "Content-Disposition": `attachment; filename=\"${safeFilename}\"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (!isStorageFileNotFoundError(error)) {
      console.error("[open/v1/emails/attachments] failed to read attachment:", error);
    }
    return NextResponse.json({ error: "Attachment file not found" }, { status: 404 });
  }
}
