import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession, isSuperAdminRole } from "@/lib/rbac";
import { readJsonBody } from "@/lib/request";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";

const bulkSchema = z
  .object({
    action: z.enum(["activate", "deactivate", "assignGroup"]),
    ids: z.array(z.string().trim().min(1)).min(1).max(100),
    userGroupId: z.string().trim().min(1).max(80).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "assignGroup" && value.userGroupId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "userGroupId is required for assignGroup",
        path: ["userGroupId"],
      });
    }
  });

type SkippedReason = "FORBIDDEN_SUPER_ADMIN" | "CANNOT_DEACTIVATE_SELF";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`admin:users:bulk:${session.user.id}`, { limit: 30, windowMs: 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 50_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = bulkSchema.parse(bodyResult.data);
    const ids = Array.from(new Set(data.ids));

    if (data.action === "assignGroup" && typeof data.userGroupId === "string") {
      const group = await prisma.userGroup.findUnique({
        where: { id: data.userGroupId },
        select: { id: true },
      });
      if (!group) {
        return NextResponse.json({ error: "User group not found" }, { status: 404 });
      }
    }

    const targets = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, role: true },
    });
    const targetMap = new Map(targets.map((target) => [target.id, target]));
    const notFoundIds = ids.filter((id) => !targetMap.has(id));

    const isSuperAdmin = isSuperAdminRole(session.user.role);
    const allowedIds: string[] = [];
    const skipped: Array<{ id: string; reason: SkippedReason }> = [];

    for (const id of ids) {
      const target = targetMap.get(id);
      if (!target) continue;

      if (target.role === "SUPER_ADMIN" && !isSuperAdmin) {
        skipped.push({ id, reason: "FORBIDDEN_SUPER_ADMIN" });
        continue;
      }

      if (data.action === "deactivate" && id === session.user.id) {
        skipped.push({ id, reason: "CANNOT_DEACTIVATE_SELF" });
        continue;
      }

      allowedIds.push(id);
    }

    let processedCount = 0;
    if (allowedIds.length > 0) {
      if (data.action === "activate") {
        const result = await prisma.user.updateMany({
          where: { id: { in: allowedIds } },
          data: { isActive: true },
        });
        processedCount = result.count;
      } else if (data.action === "deactivate") {
        const result = await prisma.user.updateMany({
          where: { id: { in: allowedIds } },
          data: { isActive: false },
        });
        processedCount = result.count;
      } else {
        const result = await prisma.user.updateMany({
          where: { id: { in: allowedIds } },
          data: { userGroupId: data.userGroupId ?? null },
        });
        processedCount = result.count;
      }
    }

    try {
      const ip = getClientIp(request);
      const userAgent = request.headers.get("user-agent");
      await prisma.log.create({
        data: {
          level: "INFO",
          action: "USER_UPDATE",
          message: `Admin bulk updated users (${data.action})`,
          metadata: JSON.stringify({
            action: data.action,
            requestedCount: ids.length,
            processedCount,
            skippedCount: skipped.length,
            notFoundCount: notFoundIds.length,
          }),
          ip: ip || null,
          userAgent: userAgent || null,
          userId: session.user.id,
        },
      });
    } catch (error) {
      console.error("[api/admin/users/bulk] failed to write audit log:", error);
    }

    return NextResponse.json({
      success: true,
      processedCount,
      skipped,
      notFoundIds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/admin/users/bulk] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
