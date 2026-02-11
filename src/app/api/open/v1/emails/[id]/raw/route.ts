import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";
import { getStorage } from "@/lib/storage";
import { isVercelDeployment } from "@/lib/deployment/server";

const MAX_RAW_CONTENT_SIZE = 1 * 1024 * 1024;
const SIGNED_URL_EXPIRES_SECONDS = 120;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isVercelDeployment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "emails:raw" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";

  const { id } = await params;

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: authResult.apiKey.userId } },
    select: { id: true, rawContent: true, rawContentPath: true },
  });

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  let rawContent: string | null = null;

  if (email.rawContentPath) {
    try {
      const storage = getStorage();

      if (shouldDownload) {
        const signedUrl = await storage.getSignedDownloadUrl(email.rawContentPath, {
          expiresInSeconds: SIGNED_URL_EXPIRES_SECONDS,
          responseContentType: "message/rfc822",
          responseContentDisposition: `attachment; filename=\"${id}.eml\"`,
        });

        if (signedUrl) {
          return NextResponse.redirect(signedUrl, { status: 302 });
        }
      }

      const buffer = await storage.read(email.rawContentPath);
      rawContent = buffer.toString("utf8");
    } catch (error) {
      console.error("[open/v1/emails/raw] failed to read raw content from file:", error);
    }
  }

  if (!rawContent && email.rawContent) {
    rawContent = email.rawContent;
  }

  if (!rawContent) {
    return NextResponse.json({ error: "Raw content not available" }, { status: 404 });
  }

  const contentSize = Buffer.byteLength(rawContent, "utf8");
  const truncated = contentSize > MAX_RAW_CONTENT_SIZE;

  if (truncated) {
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
