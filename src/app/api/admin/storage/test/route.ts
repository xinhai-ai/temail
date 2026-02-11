import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/rbac";
import {
  getMergedS3Config,
  getStorageConfig,
  isS3ConfigComplete,
  LocalStorageProvider,
  S3StorageProvider,
  type S3ConfigDraft,
} from "@/lib/storage";
import { isVercelDeployment } from "@/lib/deployment/server";
import { readJsonBody } from "@/lib/request";
import prisma from "@/lib/prisma";
import { clearSystemSettingCache } from "@/services/system-settings";

function nowMs(): number {
  return Date.now();
}

function generateTestPath(): string {
  return `_healthchecks/storage-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.txt`;
}

async function saveS3TestResult(ok: boolean): Promise<string> {
  const testedAt = new Date().toISOString();
  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: "storage_s3_last_test_ok" },
      update: { value: ok ? "true" : "false" },
      create: { key: "storage_s3_last_test_ok", value: ok ? "true" : "false" },
    }),
    prisma.systemSetting.upsert({
      where: { key: "storage_s3_last_test_at" },
      update: { value: testedAt },
      create: { key: "storage_s3_last_test_at", value: testedAt },
    }),
  ]);
  clearSystemSettingCache("storage_s3_last_test_ok");
  clearSystemSettingCache("storage_s3_last_test_at");
  return testedAt;
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isVercelDeployment()) {
    return NextResponse.json({ ok: false, error: "Storage testing is disabled in this deployment" }, { status: 404 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 200_000 });
  const body =
    bodyResult.ok && bodyResult.data && typeof bodyResult.data === "object"
      ? (bodyResult.data as Record<string, unknown>)
      : {};

  const backend = typeof body.backend === "string" ? body.backend.trim().toLowerCase() : "";
  const config = await getStorageConfig();

  if (backend === "s3") {
    const draft: S3ConfigDraft = {
      endpoint: typeof body.endpoint === "string" ? body.endpoint : undefined,
      region: typeof body.region === "string" ? body.region : undefined,
      bucket: typeof body.bucket === "string" ? body.bucket : undefined,
      accessKeyId: typeof body.accessKeyId === "string" ? body.accessKeyId : undefined,
      secretAccessKey: typeof body.secretAccessKey === "string" ? body.secretAccessKey : undefined,
      forcePathStyle: typeof body.forcePathStyle === "boolean" ? body.forcePathStyle : undefined,
      basePrefix: typeof body.basePrefix === "string" ? body.basePrefix : undefined,
    };

    const s3 = getMergedS3Config(config, draft);
    if (!isS3ConfigComplete(s3)) {
      return NextResponse.json({ ok: false, error: "S3 configuration is incomplete" }, { status: 400 });
    }

    const provider = new S3StorageProvider({
      endpoint: s3.endpoint || undefined,
      region: s3.region,
      bucket: s3.bucket,
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
      forcePathStyle: s3.forcePathStyle,
      basePrefix: s3.basePrefix,
    });

    const path = generateTestPath();
    const start = nowMs();

    try {
      const payload = `temail-s3-test:${new Date().toISOString()}`;
      await provider.write(path, payload);
      const content = await provider.read(path);
      await provider.delete(path);

      const contentOk = content.toString("utf8") === payload;
      if (!contentOk) {
        const testedAt = await saveS3TestResult(false);
        return NextResponse.json({ ok: false, error: "S3 read/write content mismatch", testedAt }, { status: 500 });
      }

      const testedAt = await saveS3TestResult(true);
      return NextResponse.json({ ok: true, backend: "s3", latencyMs: nowMs() - start, testedAt });
    } catch (error) {
      const testedAt = await saveS3TestResult(false);
      return NextResponse.json(
        { ok: false, backend: "s3", error: error instanceof Error ? error.message : "S3 test failed", testedAt },
        { status: 500 }
      );
    }
  }

  const provider = new LocalStorageProvider(config.localPath);
  const path = generateTestPath();
  const start = nowMs();

  try {
    const payload = `temail-local-test:${new Date().toISOString()}`;
    await provider.write(path, payload);
    const content = await provider.read(path);
    await provider.delete(path);

    if (content.toString("utf8") !== payload) {
      return NextResponse.json({ ok: false, error: "Local storage read/write content mismatch" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, backend: "local", latencyMs: nowMs() - start });
  } catch (error) {
    return NextResponse.json(
      { ok: false, backend: "local", error: error instanceof Error ? error.message : "Local storage test failed" },
      { status: 500 }
    );
  }
}
