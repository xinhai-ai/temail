import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserStorageUsage, resolveEffectiveStorageQuota } from "@/services/storage-quota";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [usage, quota] = await Promise.all([
    getUserStorageUsage(session.user.id),
    resolveEffectiveStorageQuota(session.user.id),
  ]);

  const bytesPercent =
    quota.maxStorageBytes && quota.maxStorageBytes > 0
      ? Math.min(100, (usage.bytes / quota.maxStorageBytes) * 100)
      : null;

  const filesPercent =
    quota.maxStorageFiles && quota.maxStorageFiles > 0
      ? Math.min(100, (usage.files / quota.maxStorageFiles) * 100)
      : null;

  return NextResponse.json({
    usage,
    quota,
    percent: {
      bytes: bytesPercent,
      files: filesPercent,
    },
  });
}

