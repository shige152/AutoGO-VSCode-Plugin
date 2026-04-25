import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgBuildArgs } from '../../extension/commands/run/buildCommandArgs';

test('buildAgBuildArgs includes packso and code obfuscation for Android ABI builds', () => {
  const args = buildAgBuildArgs({
    target: 'arm64-v8a',
    packso: true,
    codeObfuscation: true,
  });

  assert.deepEqual(args, ['build', '-t', 'arm64-v8a', '-e', '-g']);
});

test('buildAgBuildArgs expands APK architectures and keeps code obfuscation', () => {
  const args = buildAgBuildArgs({
    target: 'apk',
    codeObfuscation: true,
    apkArchitectures: {
      'arm64-v8a': true,
      'x86_64': true,
      'x86': false,
    },
  });

  assert.deepEqual(args, ['build', '-t', 'apk[arm64-v8a,x86_64]', '-g']);
});

test('buildAgBuildArgs keeps plain APK target when no architectures are selected', () => {
  const args = buildAgBuildArgs({
    target: 'apk',
    apkArchitectures: {
      'arm64-v8a': false,
      'x86_64': false,
      'x86': false,
    },
  });

  assert.deepEqual(args, ['build', '-t', 'apk']);
});

test('buildAgBuildArgs supports iOS, IPA and DEB targets with code obfuscation', () => {
  assert.deepEqual(
    buildAgBuildArgs({ target: 'ios', codeObfuscation: true }),
    ['build', '-t', 'ios', '-g'],
  );
  assert.deepEqual(
    buildAgBuildArgs({ target: 'ipa', codeObfuscation: true }),
    ['build', '-t', 'ipa', '-g'],
  );
  assert.deepEqual(
    buildAgBuildArgs({ target: 'deb', codeObfuscation: true }),
    ['build', '-t', 'deb', '-g'],
  );
});
