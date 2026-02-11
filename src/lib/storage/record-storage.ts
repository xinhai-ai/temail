import type { StorageSignedDownloadOptions } from "./types";
import {
  fromStoredFileBackendMarker,
  getActiveStorageBackend,
  getAlternateStorageBackend,
  getStorageForBackend,
  type StorageBackend,
} from "./index";

type BackendResolution = {
  explicit: StorageBackend | null;
  primary: StorageBackend;
  fallback: StorageBackend | null;
};

async function resolveBackends(storedBackend: string | null | undefined): Promise<BackendResolution> {
  const explicit = fromStoredFileBackendMarker(storedBackend);
  if (explicit) {
    return {
      explicit,
      primary: explicit,
      fallback: null,
    };
  }

  const primary = await getActiveStorageBackend();
  return {
    explicit: null,
    primary,
    fallback: getAlternateStorageBackend(primary),
  };
}

export async function readBufferByRecordStorage(
  path: string,
  storedBackend: string | null | undefined
): Promise<Buffer> {
  const { primary, fallback } = await resolveBackends(storedBackend);

  try {
    const storage = getStorageForBackend(primary);
    return await storage.read(path);
  } catch (primaryError) {
    if (!fallback) {
      throw primaryError;
    }

    const storage = getStorageForBackend(fallback);
    return storage.read(path);
  }
}

export async function readStreamByRecordStorage(
  path: string,
  storedBackend: string | null | undefined
): Promise<NodeJS.ReadableStream> {
  const { primary, fallback } = await resolveBackends(storedBackend);

  try {
    const storage = getStorageForBackend(primary);
    return await storage.readStream(path);
  } catch (primaryError) {
    if (!fallback) {
      throw primaryError;
    }

    const storage = getStorageForBackend(fallback);
    return storage.readStream(path);
  }
}

export async function getSignedDownloadUrlByRecordStorage(
  path: string,
  storedBackend: string | null | undefined,
  options?: StorageSignedDownloadOptions
): Promise<string | null> {
  const { explicit, primary, fallback } = await resolveBackends(storedBackend);

  if (explicit) {
    const storage = getStorageForBackend(primary);
    return storage.getSignedDownloadUrl(path, options);
  }

  const primaryStorage = getStorageForBackend(primary);
  const primaryExists = await primaryStorage.exists(path).catch(() => false);
  if (primaryExists) {
    return primaryStorage.getSignedDownloadUrl(path, options);
  }

  if (!fallback) {
    return null;
  }

  const fallbackStorage = getStorageForBackend(fallback);
  const fallbackExists = await fallbackStorage.exists(path).catch(() => false);
  if (!fallbackExists) {
    return null;
  }

  return fallbackStorage.getSignedDownloadUrl(path, options);
}

export async function getSizeByRecordStorage(
  path: string,
  storedBackend: string | null | undefined
): Promise<number> {
  const { primary, fallback } = await resolveBackends(storedBackend);

  try {
    const storage = getStorageForBackend(primary);
    return await storage.getSize(path);
  } catch (primaryError) {
    if (!fallback) {
      throw primaryError;
    }

    const storage = getStorageForBackend(fallback);
    return storage.getSize(path);
  }
}

export async function deleteByRecordStorage(
  path: string,
  storedBackend: string | null | undefined
): Promise<void> {
  const { explicit, primary, fallback } = await resolveBackends(storedBackend);

  if (explicit) {
    const storage = getStorageForBackend(primary);
    await storage.delete(path);
    return;
  }

  const attemptedBackends: StorageBackend[] = [primary];
  if (fallback && fallback !== primary) {
    attemptedBackends.push(fallback);
  }

  const errors: unknown[] = [];
  let successCount = 0;

  for (const backend of attemptedBackends) {
    try {
      const storage = getStorageForBackend(backend);
      await storage.delete(path);
      successCount += 1;
    } catch (error) {
      errors.push(error);
    }
  }

  if (successCount === 0 && errors.length > 0) {
    throw errors[0];
  }
}
