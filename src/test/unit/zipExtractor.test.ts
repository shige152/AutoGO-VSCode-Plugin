import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { NodeZipExtractor } from '../../infra/zip/nodeZipExtractor';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeZipWithEntry(zipPath: string, entryName: string, data: Buffer): void {
  const nameBuffer = Buffer.from(entryName, 'utf8');
  const checksum = crc32(data);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(data.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(checksum, 16);
  centralHeader.writeUInt32LE(data.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(nameBuffer.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const localRecord = Buffer.concat([localHeader, nameBuffer, data]);
  const centralRecord = Buffer.concat([centralHeader, nameBuffer]);

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(1, 8);
  endRecord.writeUInt16LE(1, 10);
  endRecord.writeUInt32LE(centralRecord.length, 12);
  endRecord.writeUInt32LE(localRecord.length, 16);
  endRecord.writeUInt16LE(0, 20);

  fs.writeFileSync(zipPath, Buffer.concat([localRecord, centralRecord, endRecord]));
}

test('zipExtractor flattens platform-tools prefix', async () => {
  const zipPath = path.join(createTempDir('autogo-zip-'), 'adb.zip');
  const extractDir = createTempDir('autogo-out-');

  const zip = new AdmZip();
  zip.addFile('platform-tools/adb', Buffer.from('adb'));
  zip.addFile('platform-tools/fastboot', Buffer.from('fastboot'));
  zip.writeZip(zipPath);

  const extractor = new NodeZipExtractor();
  await extractor.extract(zipPath, extractDir, { stripPrefix: 'platform-tools/', requirePrefix: true });

  assert.equal(fs.existsSync(path.join(extractDir, 'adb')), true);
  assert.equal(fs.existsSync(path.join(extractDir, 'platform-tools')), false);
});

test('zipExtractor rejects zip slip entries', async () => {
  const zipPath = path.join(createTempDir('autogo-zip-'), 'evil.zip');
  const extractDir = createTempDir('autogo-out-');

  writeZipWithEntry(zipPath, '../evil', Buffer.from('bad'));

  const extractor = new NodeZipExtractor();

  await assert.rejects(
    () => extractor.extract(zipPath, extractDir, { stripPrefix: 'platform-tools/', requirePrefix: false }),
    /Zip slip blocked/,
  );
});
