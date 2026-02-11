import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  getSignedDownloadUrlByRecordStorage,
  isStorageFileNotFoundError,
  readBufferByRecordStorage,
} from "@/lib/storage/record-storage";
import { isVercelDeployment } from "@/lib/deployment/server";

// Maximum raw content size to return (1MB)
const MAX_RAW_CONTENT_SIZE = 1 * 1024 * 1024;
const SIGNED_URL_EXPIRES_SECONDS = 120;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isVercelDeployment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";

  const { id } = await params;

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: session.user.id } },
    select: { id: true, rawContent: true, rawContentPath: true, rawStorageBackend: true },
  });

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  let rawContent: string | null = null;

  // Try to read from file first if path is provided
  if (email.rawContentPath) {
    try {
      if (shouldDownload) {
        const signedUrl = await getSignedDownloadUrlByRecordStorage(
          email.rawContentPath,
          email.rawStorageBackend,
          {
            expiresInSeconds: SIGNED_URL_EXPIRES_SECONDS,
            responseContentType: "message/rfc822",
            responseContentDisposition: `attachment; filename=\"${id}.eml\"`,
          }
        );

        if (signedUrl) {
          return NextResponse.redirect(signedUrl, { status: 302 });
        }
      }

      const buffer = await readBufferByRecordStorage(email.rawContentPath, email.rawStorageBackend);
      rawContent = buffer.toString("utf8");
    } catch (error) {
      if (!isStorageFileNotFoundError(error)) {
        console.error("[api/emails/raw] failed to read raw content from file:", error);
      }
    }
  }

  // Fall back to database content for backward compatibility
  if (!rawContent && email.rawContent) {
    rawContent = email.rawContent;
  }

  if (!rawContent) {
    return NextResponse.json({ error: "Raw content not available" }, { status: 404 });
  }

  // Check if content exceeds size limit
  const contentSize = Buffer.byteLength(rawContent, "utf8");
  const truncated = contentSize > MAX_RAW_CONTENT_SIZE;

  if (truncated) {
    // Truncate content and add notice
    const truncatedContent = rawContent.slice(0, MAX_RAW_CONTENT_SIZE);
    const notice = `\n\n--- Content truncated (${(contentSize / 1024 / 1024).toFixed(2)}MB exceeds ${MAX_RAW_CONTENT_SIZE / 1024 / 1024}MB limit) ---`;
    rawContent = truncatedContent + notice;
  }

  return new NextResponse(rawContent, {
    status: 200,
    headers: {
      "Content-Type": "message/rfc822",
      "Content-Disposition": shouldDownload
        ? `attachment; filename=\"${id}.eml\"`
        : `inline; filename=\"${id}.eml\"`,
      "X-Content-Truncated": truncated ? "true" : "false",
      "X-Original-Size": String(contentSize),
    },
  });
}
