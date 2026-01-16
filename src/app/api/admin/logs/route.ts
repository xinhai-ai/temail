import { NextRequest, NextResponse } from "next/server";
import { LogAction, LogLevel } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const level = searchParams.get("level");
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");
  const search = searchParams.get("search") || "";

  const where = {
    ...(level && { level: level as LogLevel }),
    ...(action && { action: action as LogAction }),
    ...(userId && { userId }),
    ...(search && {
      OR: [
        { message: { contains: search } },
        { metadata: { contains: search } },
        { ip: { contains: search } },
      ],
    }),
  };

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.log.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
