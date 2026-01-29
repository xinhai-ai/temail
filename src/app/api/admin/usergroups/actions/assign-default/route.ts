import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/rbac";
import { assignDefaultUserGroupToUnassignedUsers } from "@/services/usergroups/default-group";

export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await assignDefaultUserGroupToUnassignedUsers();
  return NextResponse.json(result);
}

