import { isVercelDeployment } from "@/lib/deployment/server";
import { getSystemSettingValue } from "@/services/system-settings";
import { getStoragePath } from "./utils";

export type StorageBackend = "local" | "s3";

export type StorageConfig = {
  backend: StorageBackend;
  localPath: string;
  s3: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    basePrefix: string;
  };
};

export type S3ConfigDraft = {
  endpoint?: string | null;
  region?: string | null;
  bucket?: string | null;
  accessKeyId?: string | null;
  secretAccessKey?: string | null;
  forcePathStyle?: boolean | null;
  basePrefix?: string | null;
};

function parseBoolean(value: string | null | undefined): boolean {
  const raw = (value || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

function normalize(value: string | null | undefined): string {
  return (value || "").trim();
}

export async function getStorageConfig(options?: { ttlMs?: number }): Promise<StorageConfig> {
  const ttlMs = options?.ttlMs;

  const [backend, endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle, basePrefix] =
    await Promise.all([
      getSystemSettingValue("storage_backend", { ttlMs }),
      getSystemSettingValue("storage_s3_endpoint", { ttlMs }),
      getSystemSettingValue("storage_s3_region", { ttlMs }),
      getSystemSettingValue("storage_s3_bucket", { ttlMs }),
      getSystemSettingValue("storage_s3_access_key_id", { ttlMs }),
      getSystemSettingValue("storage_s3_secret_access_key", { ttlMs }),
      getSystemSettingValue("storage_s3_force_path_style", { ttlMs }),
      getSystemSettingValue("storage_s3_base_prefix", { ttlMs }),
    ]);

  const deploymentIsVercel = isVercelDeployment();
  const effectiveBackend: StorageBackend =
    !deploymentIsVercel && normalize(backend) === "s3" ? "s3" : "local";

  return {
    backend: effectiveBackend,
    localPath: getStoragePath(),
    s3: {
      endpoint: normalize(endpoint),
      region: normalize(region),
      bucket: normalize(bucket),
      accessKeyId: normalize(accessKeyId),
      secretAccessKey: normalize(secretAccessKey),
      forcePathStyle: parseBoolean(forcePathStyle),
      basePrefix: normalize(basePrefix),
    },
  };
}

export function getMergedS3Config(config: StorageConfig, draft?: S3ConfigDraft): StorageConfig["s3"] {
  if (!draft) return config.s3;
  return {
    endpoint: normalize(draft.endpoint ?? config.s3.endpoint),
    region: normalize(draft.region ?? config.s3.region),
    bucket: normalize(draft.bucket ?? config.s3.bucket),
    accessKeyId: normalize(draft.accessKeyId ?? config.s3.accessKeyId),
    secretAccessKey: normalize(draft.secretAccessKey ?? config.s3.secretAccessKey),
    forcePathStyle:
      typeof draft.forcePathStyle === "boolean" ? draft.forcePathStyle : config.s3.forcePathStyle,
    basePrefix: normalize(draft.basePrefix ?? config.s3.basePrefix),
  };
}

export function isS3ConfigComplete(config: StorageConfig["s3"]): boolean {
  return Boolean(config.region && config.bucket && config.accessKeyId && config.secretAccessKey);
}

