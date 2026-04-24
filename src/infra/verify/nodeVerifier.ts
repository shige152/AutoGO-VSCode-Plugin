import * as fs from 'fs';
import { Verifier, VerifyOptions } from '../../app/ports/verifier';

export class NodeVerifier implements Verifier {
  async verifyFile(path: string, options: VerifyOptions = {}): Promise<void> {
    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(path);
    } catch (error) {
      throw new Error(`Missing file: ${path}`);
    }

    if (stats.isDirectory()) {
      throw new Error(`Expected file but found directory: ${path}`);
    }
    if (stats.size <= 0) {
      throw new Error(`File is empty: ${path}`);
    }

    if (options.chmodExecutable) {
      await fs.promises.chmod(path, 0o755);
    }
  }
}
