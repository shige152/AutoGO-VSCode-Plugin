import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdbExecutablePath,
  getAdbInstallDir,
  getAdbZipPath,
  getAgExecutablePath,
  getToolLockPath,
} from '../../core/tooling/toolPaths';

test('toolPaths returns fixed Public paths on Windows', () => {
  assert.equal(getAgExecutablePath('win32'), 'C:\\Users\\Public\\ag.exe');
  assert.equal(
    getAdbZipPath('win32'),
    'C:\\Users\\Public\\ADB-platform-tools-latest-windows.zip',
  );
  assert.equal(getAdbInstallDir('win32'), 'C:\\Users\\Public\\ADB-platform-tools');
  assert.equal(getAdbExecutablePath('win32'), 'C:\\Users\\Public\\ADB-platform-tools\\adb.exe');
  assert.equal(getToolLockPath('adb', 'win32'), 'C:\\Users\\Public\\.autogo.adb.lock');
});

test('toolPaths returns fixed Public paths on macOS', () => {
  assert.equal(getAgExecutablePath('darwin'), '/Users/Shared/ag');
  assert.equal(getAdbZipPath('darwin'), '/Users/Shared/ADB-platform-tools-latest-darwin.zip');
  assert.equal(getAdbInstallDir('darwin'), '/Users/Shared/ADB-platform-tools');
  assert.equal(getAdbExecutablePath('darwin'), '/Users/Shared/ADB-platform-tools/adb');
  assert.equal(getToolLockPath('adb', 'darwin'), '/Users/Shared/.autogo.adb.lock');
});
