import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/rbac";
import { listUsersStorageUsage } from "@/services/storage-quota";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const search = (searchParams.get("search") || "").trim();

  const data = await listUsersStorageUsage({ page, limit, search });
  return NextResponse.json(data);
}

