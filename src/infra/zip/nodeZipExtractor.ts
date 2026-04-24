import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import StreamZip from 'node-stream-zip';
import { ZipExtractor, ZipExtractOptions } from '../../app/ports/zipExtractor';
import { Logger } from '../../app/ports/logger';
import { validateZipEntryPath } from '../../core/zip/zipSlip';

function isSymlink(entry: StreamZip.ZipEntry): boolean {
  const unixMode = (entry.attr >> 16) & 0o170000;
  return unixMode === 0o120000;
}

export class NodeZipExtractor implements ZipExtractor {
  constructor(private logger?: Logger) {}

  async extract(zipPath: string, targetDir: string, options: ZipExtractOptions = {}): Promise<void> {
    const zip = new StreamZip.async({ file: zipPath, storeEntries: true, skipEntryNameValidation: true });
    let hasPrefix = false;
    try {
      const entries = await zip.entries();
      for (const entry of Object.values(entries)) {
        if (entry.isDirectory) {
          continue;
        }
        if (isSymlink(entry)) {
          throw new Error(`Symlink entry not allowed: ${entry.name}`);
        }

        let relative = entry.name;
        const rawCheck = validateZipEntryPath(targetDir, relative);
        if (!rawCheck.ok) {
          throw new Error(`Zip slip blocked: ${entry.name}`);
        }
        if (options.stripPrefix) {
          if (!relative.startsWith(options.stripPrefix)) {
            if (options.requirePrefix) {
              continue;
            }
            continue;
          }
          hasPrefix = true;
          relative = relative.slice(options.stripPrefix.length);
        }

        if (!relative) {
          continue;
        }

        const check = validateZipEntryPath(targetDir, relative);
        if (!check.ok || !check.resolvedPath) {
          throw new Error(`Zip slip blocked: ${entry.name}`);
        }

        await fs.promises.mkdir(path.dirname(check.resolvedPath), { recursive: true });
        const readStream = await zip.stream(entry);
        await pipeline(readStream, fs.createWriteStream(check.resolvedPath));
      }

      if (options.requirePrefix && options.stripPrefix && !hasPrefix) {
        throw new Error(`Required prefix not found: ${options.stripPrefix}`);
      }
    } finally {
      await zip.close();
    }
  }
}
