import { LocalStorageProvider } from "./local";
import type { StorageProvider } from "./types";

export type { StorageProvider } from "./types";
export { LocalStorageProvider } from "./local";
export {
  generateRawContentPath,
  generateAttachmentPath,
  sanitizeFilename,
  formatFileSize,
  getMaxAttachmentSize,
  getStoragePath,
} from "./utils";

// Singleton instance of the storage provider
let storageInstance: StorageProvider | null = null;

/**
 * Gets the storage provider instance.
 * Currently only supports local file system storage.
 */
export function getStorage(): StorageProvider {
  if (!storageInstance) {
    storageInstance = new LocalStorageProvider();
  }
  return storageInstance;
}

/**
 * Sets a custom storage provider instance (useful for testing).
 */
export function setStorage(provider: StorageProvider): void {
  storageInstance = provider;
}
