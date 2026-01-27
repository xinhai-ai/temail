import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import {
  generateOpenApiKeyToken,
  parseOpenApiScopes,
  serializeOpenApiScopes,
} from "@/lib/open-api/api-keys";
import { DEFAULT_OPEN_API_KEY_SCOPES, OPEN_API_SCOPES_ZOD } from "@/lib/open-api/scopes";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80).default("API Key"),
  scopes: z.array(z.enum(OPEN_API_SCOPES_ZOD)).min(1).max(50).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      usageCount: true,
      lastUsedAt: true,
      disabledAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    keys: keys.map((key) => ({
      ...key,
      scopes: parseOpenApiScopes(key.scopes),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 10_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const parsed = createSchema.parse(bodyResult.data);
    const scopes = parsed.scopes?.length ? parsed.scopes : DEFAULT_OPEN_API_KEY_SCOPES;

    const generated = generateOpenApiKeyToken();
    const created = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name: parsed.name,
        keyPrefix: generated.keyPrefix,
        keyHash: generated.keyHash,
        scopes: serializeOpenApiScopes(scopes),
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        usageCount: true,
        lastUsedAt: true,
        disabledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      key: {
        ...created,
        scopes: parseOpenApiScopes(created.scopes),
      },
      token: generated.token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[open-api/keys] create failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
