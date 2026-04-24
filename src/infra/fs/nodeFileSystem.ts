import * as fs from 'fs';
import * as path from 'path';
import { FileSystem } from '../../app/ports/fileSystem';

export class NodeFileSystem implements FileSystem {
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async stat(filePath: string): Promise<{ size: number; isDirectory(): boolean }> {
    return fs.promises.stat(filePath);
  }

  async mkdirp(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  async readFile(filePath: string): Promise<Buffer> {
    return fs.promises.readFile(filePath);
  }

  async writeFile(filePath: string, data: Buffer | string): Promise<void> {
    await fs.promises.writeFile(filePath, data);
  }

  async copyFile(source: string, target: string): Promise<void> {
    await fs.promises.copyFile(source, target);
  }

  async unlink(filePath: string): Promise<void> {
    await fs.promises.unlink(filePath);
  }

  async rename(source: string, target: string): Promise<void> {
    await fs.promises.rename(source, target);
  }

  async chmod(filePath: string, mode: number): Promise<void> {
    await fs.promises.chmod(filePath, mode);
  }
}
