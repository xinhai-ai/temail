import { NextRequest, NextResponse } from "next/server";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";
import { restoreOwnedEmailFromTrash } from "@/services/email-trash";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "emails:write" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const restored = await restoreOwnedEmailFromTrash({ emailId: id, userId: authResult.apiKey.userId });
  if (!restored) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
