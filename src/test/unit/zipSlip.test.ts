import test from 'node:test';
import assert from 'node:assert/strict';
import { validateZipEntryPath } from '../../core/zip/zipSlip';

test('zipSlip allows safe relative paths', () => {
  const result = validateZipEntryPath('/tmp/target', 'platform-tools/adb');
  assert.equal(result.ok, true);
  assert.ok(result.resolvedPath);
});

test('zipSlip rejects traversal paths', () => {
  const result = validateZipEntryPath('/tmp/target', '../evil');
  assert.equal(result.ok, false);
});

test('zipSlip rejects absolute paths', () => {
  const unix = validateZipEntryPath('/tmp/target', '/etc/passwd');
  const win = validateZipEntryPath('/tmp/target', 'C:\\\\evil\\\\file');
  assert.equal(unix.ok, false);
  assert.equal(win.ok, false);
});

test('zipSlip rejects null bytes', () => {
  const result = validateZipEntryPath('/tmp/target', 'bad\u0000path');
  assert.equal(result.ok, false);
});
