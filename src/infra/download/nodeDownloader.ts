import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { URL } from 'url';
import type { ClientRequest } from 'http';
import { Downloader, DownloadOptions } from '../../app/ports/downloader';
import { FileSystem } from '../../app/ports/fileSystem';
import { Logger } from '../../app/ports/logger';

export class NodeDownloader implements Downloader {
  constructor(private fileSystem: FileSystem, private logger?: Logger) {}

  async download(url: string, destinationPath: string, options: DownloadOptions = {}): Promise<void> {
    await this.fileSystem.mkdirp(path.dirname(destinationPath));
    const tmpPath = `${destinationPath}.tmp`;
    await this.downloadInternal(url, tmpPath, options, 0);
    await this.replaceFile(tmpPath, destinationPath);
  }

  private async downloadInternal(
    url: string,
    tmpPath: string,
    options: DownloadOptions,
    redirectCount: number,
  ): Promise<void> {
    if (redirectCount > 5) {
      throw new Error(`Too many redirects: ${url}`);
    }

    await new Promise<void>((resolve, reject) => {
      const stream = fs.createWriteStream(tmpPath);
      let received = 0;
      let total: number | undefined;
      const abortSignal = options.signal;
      let request: ClientRequest | undefined;

      const onAbort = () => {
        request?.destroy(new Error('Download aborted'));
        stream.destroy();
      };

      if (abortSignal) {
        if (abortSignal.aborted) {
          onAbort();
          return reject(new Error('Download aborted'));
        }
        abortSignal.addEventListener('abort', onAbort, { once: true });
      }

      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      request = protocol.get(url, (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          stream.close();
          abortSignal?.removeEventListener('abort', onAbort);
          return resolve(
            this.downloadInternal(response.headers.location, tmpPath, options, redirectCount + 1),
          );
        }

        if (status !== 200) {
          stream.close();
          abortSignal?.removeEventListener('abort', onAbort);
          return reject(new Error(`Download failed: ${status}`));
        }

        const length = response.headers['content-length'];
        total = length ? Number(length) : undefined;

        response.on('data', (chunk: Buffer) => {
          received += chunk.length;
          options.onProgress?.({ transferredBytes: received, totalBytes: total });
        });

        response.pipe(stream);
        stream.on('finish', () => {
          stream.close();
          abortSignal?.removeEventListener('abort', onAbort);
          resolve();
        });
      });

      request.on('error', (error: Error) => {
        stream.close();
        abortSignal?.removeEventListener('abort', onAbort);
        reject(error);
      });
    });
  }

  private async replaceFile(tmpPath: string, destinationPath: string): Promise<void> {
    const exists = await this.fileSystem.exists(destinationPath);
    if (exists) {
      try {
        await this.fileSystem.unlink(destinationPath);
      } catch (error) {
        this.logger?.warn(`Failed to remove existing file: ${destinationPath}`);
      }
    }
    await this.fileSystem.rename(tmpPath, destinationPath);
  }
}
