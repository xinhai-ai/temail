export interface StorageProvider {
  write(path: string, content: Buffer | string): Promise<void>;
  read(path: string): Promise<Buffer>;
  readStream(path: string): Promise<NodeJS.ReadableStream>;
  exists(path: string): Promise<boolean>;
  getSize(path: string): Promise<number>;
  delete(path: string): Promise<void>;
}
