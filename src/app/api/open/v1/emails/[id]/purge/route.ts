import { NextRequest, NextResponse } from "next/server";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";
import { purgeOwnedEmail } from "@/services/email-trash";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "emails:write" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const purged = await purgeOwnedEmail({ emailId: id, userId: authResult.apiKey.userId });
  if (!purged) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
