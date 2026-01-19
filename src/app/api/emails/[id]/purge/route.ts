import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { publishRealtimeEvent } from "@/lib/realtime/server";
import { purgeOwnedEmail } from "@/services/email-trash";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const purged = await purgeOwnedEmail({ emailId: id, userId: session.user.id });
  if (!purged) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  publishRealtimeEvent(session.user.id, {
    type: "email.deleted",
    data: { id: purged.id, mailboxId: purged.mailboxId },
  });

  return NextResponse.json({ success: true });
}

