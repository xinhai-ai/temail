import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";
import type { StorageProvider } from "./types";
import { getStorageConfig, isS3ConfigComplete } from "./config";

export type { StorageProvider } from "./types";
export { LocalStorageProvider } from "./local";
export { S3StorageProvider } from "./s3";
export { getStorageConfig, getMergedS3Config, isS3ConfigComplete, type StorageBackend, type StorageConfig, type S3ConfigDraft } from "./config";
export {
  generateRawContentPath,
  generateAttachmentPath,
  sanitizeFilename,
  formatFileSize,
  getMaxAttachmentSize,
  getStoragePath,
} from "./utils";

type ProviderCache = {
  local: LocalStorageProvider | null;
  s3: S3StorageProvider | null;
};

const cache: ProviderCache = {
  local: null,
  s3: null,
};

const CONFIG_TTL_MS = 30_000;

class DynamicStorageProvider implements StorageProvider {
  private overrideProvider: StorageProvider | null = null;

  setOverride(provider: StorageProvider | null): void {
    this.overrideProvider = provider;
  }

  private async resolveProvider(): Promise<StorageProvider> {
    if (this.overrideProvider) {
      return this.overrideProvider;
    }

    const config = await getStorageConfig({ ttlMs: CONFIG_TTL_MS });

    if (config.backend === "s3" && isS3ConfigComplete(config.s3)) {
      if (!cache.s3) {
        cache.s3 = new S3StorageProvider({
          endpoint: config.s3.endpoint || undefined,
          region: config.s3.region,
          bucket: config.s3.bucket,
          accessKeyId: config.s3.accessKeyId,
          secretAccessKey: config.s3.secretAccessKey,
          forcePathStyle: config.s3.forcePathStyle,
          basePrefix: config.s3.basePrefix,
        });
      }
      return cache.s3;
    }

    if (!cache.local) {
      cache.local = new LocalStorageProvider(config.localPath);
    }
    return cache.local;
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
}

const dynamicStorage = new DynamicStorageProvider();

/**
 * Gets the storage provider instance.
 */
export function getStorage(): StorageProvider {
  return dynamicStorage;
}

/**
 * Sets a custom storage provider instance (useful for testing).
 */
export function setStorage(provider: StorageProvider): void {
  dynamicStorage.setOverride(provider);
}

export function resetStorageProviderCache(): void {
  cache.local = null;
  cache.s3 = null;
  dynamicStorage.setOverride(null);
}
