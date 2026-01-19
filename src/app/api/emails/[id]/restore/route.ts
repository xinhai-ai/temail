import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { publishRealtimeEvent } from "@/lib/realtime/server";
import { restoreOwnedEmailFromTrash } from "@/services/email-trash";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const restored = await restoreOwnedEmailFromTrash({ emailId: id, userId: session.user.id });
  if (!restored) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  publishRealtimeEvent(session.user.id, {
    type: "email.updated",
    data: { id: restored.id, mailboxId: restored.mailboxId, status: restored.status },
  });

  return NextResponse.json({ success: true });
}

