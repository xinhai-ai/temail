import path from "path";

/**
 * Generates a storage path for raw email content.
 * Format: raw/{year}/{month}/{emailId}.eml
 */
export function generateRawContentPath(emailId: string, date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `raw/${year}/${month}/${emailId}.eml`;
}

/**
 * Generates a storage path for attachment files.
 * Format: attachments/{year}/{month}/{attachmentId}/{filename}
 */
export function generateAttachmentPath(
  attachmentId: string,
  filename: string,
  date: Date
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const sanitizedFilename = sanitizeFilename(filename);
  return `attachments/${year}/${month}/${attachmentId}/${sanitizedFilename}`;
}

/**
 * Sanitizes a filename by removing or replacing unsafe characters.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") {
    return "unnamed";
  }

  // Decode percent-encoded characters first
  let decoded = filename;
  try {
    decoded = decodeURIComponent(filename);
  } catch {
    // If decoding fails, use the original filename
  }

  // Remove path separators and dangerous characters
  let sanitized = decoded
    .replace(/[/\\]/g, "_") // Replace path separators
    .replace(/[\x00-\x1f\x7f]/g, "") // Remove control characters
    .replace(/[<>:"|?*]/g, "_") // Replace Windows-invalid characters
    .trim();

  // Remove leading dots to prevent hidden files
  sanitized = sanitized.replace(/^\.+/, "");

  // Truncate to reasonable length (255 bytes is common filesystem limit)
  if (sanitized.length > 200) {
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    sanitized = base.slice(0, 200 - ext.length) + ext;
  }

  // Fallback if empty
  if (!sanitized) {
    return "unnamed";
  }

  return sanitized;
}

/**
 * Formats file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Gets the maximum allowed attachment size from environment.
 * Default: 25MB (26214400 bytes)
 */
export function getMaxAttachmentSize(): number {
  const envValue = process.env.ATTACHMENT_MAX_SIZE;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 26214400; // 25MB default
}

/**
 * Gets the storage base path from environment.
 * Default: ./storage for development
 */
export function getStoragePath(): string {
  return process.env.STORAGE_PATH || "./data/storage";
}
