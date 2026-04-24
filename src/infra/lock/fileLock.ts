import * as fs from 'fs';
import { FileLock, FileLockHandle, FileLockOptions } from '../../app/ports/fileLock';
import { Logger } from '../../app/ports/logger';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class NodeFileLock implements FileLock {
  constructor(private logger?: Logger, private pollIntervalMs: number = 500) {}

  async acquire(lockPath: string, options: FileLockOptions): Promise<FileLockHandle> {
    const start = Date.now();

    while (true) {
      try {
        const fileHandle = await fs.promises.open(lockPath, 'wx');
        const payload = `${process.pid}\\n${new Date().toISOString()}\\n`;
        await fileHandle.write(payload);
        await fileHandle.close();
        return {
          release: async () => {
            try {
              await fs.promises.unlink(lockPath);
            } catch {
              // ignore
            }
          },
        };
      } catch (error: any) {
        if (error?.code !== 'EEXIST') {
          throw error;
        }
        if (Date.now() - start > options.timeoutMs) {
          const message = `Lock timeout after ${options.timeoutMs}ms: ${lockPath}`;
          if (this.logger) {
            this.logger.error(message);
          }
          throw new Error(message);
        }
        if (this.logger) {
          this.logger.info(`Waiting for lock: ${lockPath}`);
        }
        await sleep(this.pollIntervalMs);
      }
    }
  }
}
