import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getStorage } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, attachmentId } = await params;

  // Verify email belongs to user and get attachment
  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: session.user.id } },
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

  try {
    const storage = getStorage();
    const stream = await storage.readStream(attachment.path);

    // Convert Node.js stream to Web ReadableStream
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

    // Sanitize filename for Content-Disposition header
    const safeFilename = attachment.filename
      .replace(/[^\w\s.-]/g, "_")
      .replace(/\s+/g, "_");

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": attachment.contentType || "application/octet-stream",
        "Content-Length": String(attachment.size),
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[api/emails/attachments] failed to read attachment:", error);
    return NextResponse.json({ error: "Attachment file not found" }, { status: 404 });
  }
}
