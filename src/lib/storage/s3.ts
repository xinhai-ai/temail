import { Readable } from "stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { StorageProvider } from "./types";

function normalizePrefix(prefix?: string | null): string {
  const value = (prefix || "").trim();
  if (!value) return "";
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

export type S3StorageProviderOptions = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  basePrefix?: string;
};

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(options: S3StorageProviderOptions) {
    this.bucket = options.bucket;
    this.prefix = normalizePrefix(options.basePrefix);
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint || undefined,
      forcePathStyle: Boolean(options.forcePathStyle),
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  private toKey(relativePath: string): string {
    const key = relativePath.replace(/^\/+/, "");
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async write(relativePath: string, content: Buffer | string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.toKey(relativePath),
        Body: content,
      })
    );
  }

  async read(relativePath: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.toKey(relativePath),
      })
    );

    const body = response.Body;
    if (!body) {
      throw new Error("S3 object body is empty");
    }

    if (typeof (body as Readable).pipe === "function") {
      const chunks: Buffer[] = [];
      for await (const chunk of body as Readable) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    throw new Error("Unsupported S3 response body type");
  }

  async readStream(relativePath: string): Promise<NodeJS.ReadableStream> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.toKey(relativePath),
      })
    );

    const body = response.Body;
    if (!body || typeof (body as Readable).pipe !== "function") {
      throw new Error("S3 object stream is unavailable");
    }

    return body as Readable;
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.toKey(relativePath),
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async getSize(relativePath: string): Promise<number> {
    const result = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.toKey(relativePath),
      })
    );
    return Number(result.ContentLength || 0);
  }

  async delete(relativePath: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.toKey(relativePath),
      })
    );
  }
}

