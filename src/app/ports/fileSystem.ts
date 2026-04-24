export interface FileSystem {
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ size: number; isDirectory(): boolean }>;
  mkdirp(path: string): Promise<void>;
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, data: Buffer | string): Promise<void>;
  copyFile(source: string, target: string): Promise<void>;
  unlink(path: string): Promise<void>;
  rename(source: string, target: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
}
