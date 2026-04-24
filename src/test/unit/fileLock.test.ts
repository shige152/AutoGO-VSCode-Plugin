import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NodeFileLock } from '../../infra/lock/fileLock';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('file lock waits for release', async () => {
  const dir = createTempDir('autogo-lock-');
  const lockPath = path.join(dir, '.lock');
  const lock = new NodeFileLock(undefined, 50);

  const handle1 = await lock.acquire(lockPath, { timeoutMs: 2000 });
  const start = Date.now();

  const acquire2 = lock.acquire(lockPath, { timeoutMs: 2000 });
  await new Promise((resolve) => setTimeout(resolve, 200));
  await handle1.release();

  const handle2 = await acquire2;
  const elapsed = Date.now() - start;

  assert.ok(elapsed >= 150);
  await handle2.release();
});
