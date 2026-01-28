import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import { parseAiProviderModels } from "@/lib/workflow/ai-provider";

function normalizeValue(value: string | null | undefined): string | null {
  const trimmed = (value || "").trim();
  return trimmed ? trimmed : null;
}

function parseSource(value: string | null): "rewrite" | "classifier" | null {
  if (value === "rewrite" || value === "classifier") return value;
  return null;
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedSource = request.nextUrl.searchParams.get("source");
  const source = parseSource(requestedSource);
  if (requestedSource && !source) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const keys = [
    "ai_provider_base_url",
    "ai_provider_api_key",
    "ai_provider_models",
    "ai_rewrite_base_url",
    "ai_rewrite_api_key",
    "ai_rewrite_model",
    "ai_classifier_base_url",
    "ai_classifier_api_key",
    "ai_classifier_model",
  ];

  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });

  const values = new Map(settings.map((s) => [s.key, s.value]));

  const providerBaseUrl = normalizeValue(values.get("ai_provider_base_url"));
  const providerApiKey = normalizeValue(values.get("ai_provider_api_key"));
  const providerModels = parseAiProviderModels(values.get("ai_provider_models"));

  const rewrite = {
    baseUrl: normalizeValue(values.get("ai_rewrite_base_url")),
    apiKey: normalizeValue(values.get("ai_rewrite_api_key")),
    model: normalizeValue(values.get("ai_rewrite_model")),
  };
  const classifier = {
    baseUrl: normalizeValue(values.get("ai_classifier_base_url")),
    apiKey: normalizeValue(values.get("ai_classifier_api_key")),
    model: normalizeValue(values.get("ai_classifier_model")),
  };

  const defaultSource: "rewrite" | "classifier" | null =
    rewrite.baseUrl || rewrite.apiKey ? "rewrite" : classifier.baseUrl || classifier.apiKey ? "classifier" : null;

  const chosenSource = source || defaultSource;
  if (!chosenSource) {
    return NextResponse.json({ error: "No legacy AI settings found" }, { status: 400 });
  }

  const legacy = chosenSource === "rewrite" ? rewrite : classifier;
  if (!legacy.baseUrl && !legacy.apiKey) {
    return NextResponse.json({ error: "Selected source has no legacy AI settings" }, { status: 400 });
  }

  const updates: { key: string; value: string }[] = [];

  if (!providerBaseUrl && legacy.baseUrl) {
    updates.push({ key: "ai_provider_base_url", value: legacy.baseUrl });
  }

  if (!providerApiKey && legacy.apiKey) {
    updates.push({ key: "ai_provider_api_key", value: legacy.apiKey });
  }

  const seedModels = [rewrite.model, classifier.model].filter((m): m is string => typeof m === "string" && m.length > 0);
  const mergedModels = Array.from(new Set([...providerModels, ...seedModels]));
  if (mergedModels.length > providerModels.length) {
    updates.push({ key: "ai_provider_models", value: JSON.stringify(mergedModels) });
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, source: chosenSource, updatedKeys: [] });
  }

  await prisma.$transaction(
    updates.map((item) =>
      prisma.systemSetting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value },
      })
    )
  );

  return NextResponse.json({ ok: true, source: chosenSource, updatedKeys: updates.map((u) => u.key) });
}

