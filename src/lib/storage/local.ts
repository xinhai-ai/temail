import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import type { StorageProvider } from "./types";
import { getStoragePath } from "./utils";

export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || getStoragePath();
  }

  private resolvePath(relativePath: string): string {
    // Prevent path traversal attacks
    const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
    return path.join(this.basePath, normalized);
  }

  async write(relativePath: string, content: Buffer | string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content);
  }

  async read(relativePath: string): Promise<Buffer> {
    const fullPath = this.resolvePath(relativePath);
    return fs.readFile(fullPath);
  }

  async readStream(relativePath: string): Promise<NodeJS.ReadableStream> {
    const fullPath = this.resolvePath(relativePath);

    // Check if file exists first
    await fs.access(fullPath);

    return createReadStream(fullPath);
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(relativePath: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
