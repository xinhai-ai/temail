import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";
import type { StorageProvider, StorageSignedDownloadOptions } from "./types";
import { getStorageConfig, isS3ConfigComplete, type StorageBackend, type StorageConfig } from "./config";

export type { StorageProvider, StorageSignedDownloadOptions } from "./types";
export { LocalStorageProvider } from "./local";
export { S3StorageProvider } from "./s3";
export {
  getStorageConfig,
  getMergedS3Config,
  isS3ConfigComplete,
  type StorageBackend,
  type StorageConfig,
  type S3ConfigDraft,
} from "./config";
export {
  generateRawContentPath,
  generateAttachmentPath,
  sanitizeFilename,
  formatFileSize,
  getMaxAttachmentSize,
  getStoragePath,
} from "./utils";

export type StoredFileBackendMarker = "LOCAL" | "S3";

type ProviderCache = {
  local: {
    provider: LocalStorageProvider | null;
    basePath: string | null;
  };
  s3: {
    provider: S3StorageProvider | null;
    signature: string | null;
  };
};

const cache: ProviderCache = {
  local: {
    provider: null,
    basePath: null,
  },
  s3: {
    provider: null,
    signature: null,
  },
};

const CONFIG_TTL_MS = 30_000;

let overrideProvider: StorageProvider | null = null;

function buildS3Signature(config: StorageConfig["s3"]): string {
  return JSON.stringify({
    endpoint: config.endpoint || "",
    region: config.region,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    forcePathStyle: Boolean(config.forcePathStyle),
    basePrefix: config.basePrefix || "",
  });
}

function resolveLocalProvider(config: StorageConfig): LocalStorageProvider {
  if (!cache.local.provider || cache.local.basePath !== config.localPath) {
    cache.local.provider = new LocalStorageProvider(config.localPath);
    cache.local.basePath = config.localPath;
  }
  return cache.local.provider;
}

function resolveS3Provider(config: StorageConfig): S3StorageProvider {
  const signature = buildS3Signature(config.s3);
  if (!cache.s3.provider || cache.s3.signature !== signature) {
    cache.s3.provider = new S3StorageProvider({
      endpoint: config.s3.endpoint || undefined,
      region: config.s3.region,
      bucket: config.s3.bucket,
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
      forcePathStyle: config.s3.forcePathStyle,
      basePrefix: config.s3.basePrefix,
    });
    cache.s3.signature = signature;
  }
  return cache.s3.provider;
}

async function resolveProviderForBackend(backend: StorageBackend): Promise<StorageProvider> {
  if (overrideProvider) {
    return overrideProvider;
  }

  const config = await getStorageConfig({ ttlMs: CONFIG_TTL_MS });

  if (backend === "s3") {
    if (!isS3ConfigComplete(config.s3)) {
      throw new Error("S3 storage backend is not configured");
    }
    return resolveS3Provider(config);
  }

  return resolveLocalProvider(config);
}

class DynamicStorageProvider implements StorageProvider {
  setOverride(provider: StorageProvider | null): void {
    overrideProvider = provider;
  }

  private async resolveProvider(): Promise<StorageProvider> {
    if (overrideProvider) {
      return overrideProvider;
    }

    const config = await getStorageConfig({ ttlMs: CONFIG_TTL_MS });
    if (config.backend === "s3" && isS3ConfigComplete(config.s3)) {
      return resolveS3Provider(config);
    }

    return resolveLocalProvider(config);
  }

  async write(path: string, content: Buffer | string): Promise<void> {
    const provider = await this.resolveProvider();
    await provider.write(path, content);
  }

  async read(path: string): Promise<Buffer> {
    const provider = await this.resolveProvider();
    return provider.read(path);
  }

  async readStream(path: string): Promise<NodeJS.ReadableStream> {
    const provider = await this.resolveProvider();
    return provider.readStream(path);
  }

  async exists(path: string): Promise<boolean> {
    const provider = await this.resolveProvider();
    return provider.exists(path);
  }

  async getSize(path: string): Promise<number> {
    const provider = await this.resolveProvider();
    return provider.getSize(path);
  }

  async delete(path: string): Promise<void> {
    const provider = await this.resolveProvider();
    await provider.delete(path);
  }

  async getSignedDownloadUrl(
    path: string,
    options?: StorageSignedDownloadOptions
  ): Promise<string | null> {
    const provider = await this.resolveProvider();
    return provider.getSignedDownloadUrl(path, options);
  }
}

class FixedBackendStorageProvider implements StorageProvider {
  constructor(private readonly backend: StorageBackend) {}

  private async resolveProvider(): Promise<StorageProvider> {
    return resolveProviderForBackend(this.backend);
  }

  async write(path: string, content: Buffer | string): Promise<void> {
    const provider = await this.resolveProvider();
    await provider.write(path, content);
  }

  async read(path: string): Promise<Buffer> {
    const provider = await this.resolveProvider();
    return provider.read(path);
  }

  async readStream(path: string): Promise<NodeJS.ReadableStream> {
    const provider = await this.resolveProvider();
    return provider.readStream(path);
  }

  async exists(path: string): Promise<boolean> {
    const provider = await this.resolveProvider();
    return provider.exists(path);
  }

  async getSize(path: string): Promise<number> {
    const provider = await this.resolveProvider();
    return provider.getSize(path);
  }

  async delete(path: string): Promise<void> {
    const provider = await this.resolveProvider();
    await provider.delete(path);
  }

  async getSignedDownloadUrl(
    path: string,
    options?: StorageSignedDownloadOptions
  ): Promise<string | null> {
    const provider = await this.resolveProvider();
    return provider.getSignedDownloadUrl(path, options);
  }
}

const dynamicStorage = new DynamicStorageProvider();

const fixedStorageProviders: Record<StorageBackend, StorageProvider> = {
  local: new FixedBackendStorageProvider("local"),
  s3: new FixedBackendStorageProvider("s3"),
};

/**
 * Gets the active storage provider instance.
 */
export function getStorage(): StorageProvider {
  return dynamicStorage;
}

/**
 * Gets the storage provider for a specific backend.
 */
export function getStorageForBackend(backend: StorageBackend): StorageProvider {
  return fixedStorageProviders[backend];
}

/**
 * Gets the currently active storage backend.
 */
export async function getActiveStorageBackend(): Promise<StorageBackend> {
  const config = await getStorageConfig({ ttlMs: CONFIG_TTL_MS });
  if (config.backend === "s3" && isS3ConfigComplete(config.s3)) {
    return "s3";
  }
  return "local";
}

export function getAlternateStorageBackend(backend: StorageBackend): StorageBackend {
  return backend === "s3" ? "local" : "s3";
}

export function toStoredFileBackendMarker(backend: StorageBackend): StoredFileBackendMarker {
  return backend === "s3" ? "S3" : "LOCAL";
}

export function fromStoredFileBackendMarker(value: string | null | undefined): StorageBackend | null {
  if (value === "S3") return "s3";
  if (value === "LOCAL") return "local";
  return null;
}

/**
 * Sets a custom storage provider instance (useful for testing).
 */
export function setStorage(provider: StorageProvider): void {
  dynamicStorage.setOverride(provider);
}

export function resetStorageProviderCache(): void {
  cache.local.provider = null;
  cache.local.basePath = null;
  cache.s3.provider = null;
  cache.s3.signature = null;
  overrideProvider = null;
  dynamicStorage.setOverride(null);
}
