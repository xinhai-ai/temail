import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isAdminRole } from "@/lib/rbac";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { isVercelDeployment } from "@/lib/deployment/server";
import { getAllowedDomainIdsForUser } from "@/services/usergroups/policy";

const domainSchema = z.object({
  name: z.string().min(1, "Domain name is required"),
  sourceType: z.enum(["IMAP", "WEBHOOK"]),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = isAdminRole(session.user.role);
  const allowed = await getAllowedDomainIdsForUser(session.user.id);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error, code: allowed.code }, { status: allowed.status });
  }

  const domains = await prisma.domain.findMany({
    where: isAdmin
      ? { sourceType: { not: "PERSONAL_IMAP" } }
      : {
          isPublic: true,
          status: "ACTIVE",
          sourceType: { not: "PERSONAL_IMAP" },
          ...(allowed.domainIds ? { id: { in: allowed.domainIds } } : {}),
        },
    include: {
      _count: { select: { mailboxes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(domains);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = domainSchema.parse(bodyResult.data);

    if (isVercelDeployment() && data.sourceType === "IMAP") {
      return NextResponse.json(
        { error: "IMAP is disabled in this deployment mode" },
        { status: 400 }
      );
    }

    const existing = await prisma.domain.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Domain already exists" },
        { status: 400 }
      );
    }

    const domain = await prisma.domain.create({
      data: {
        ...data,
        isPublic: data.isPublic ?? true,
        userId: session.user.id,
      },
    });

    return NextResponse.json(domain);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
