import test from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactStore } from '../../app/services/artifactStore';
import { Downloader } from '../../app/ports/downloader';
import { FileLock, FileLockHandle } from '../../app/ports/fileLock';
import { FileSystem } from '../../app/ports/fileSystem';
import { Logger } from '../../app/ports/logger';
import { Settings } from '../../app/ports/settings';
import { Verifier } from '../../app/ports/verifier';
import { ZipExtractor } from '../../app/ports/zipExtractor';

class FakeFileSystem implements FileSystem {
  private files = new Map<string, { size: number; isDir: boolean }>();

  setFile(path: string, size: number = 1): void {
    this.files.set(path, { size, isDir: false });
  }

  setDir(path: string): void {
    this.files.set(path, { size: 0, isDir: true });
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async stat(path: string): Promise<{ size: number; isDirectory(): boolean }> {
    const entry = this.files.get(path);
    if (!entry) {
      throw new Error('missing');
    }
    return {
      size: entry.size,
      isDirectory: () => entry.isDir,
    };
  }

  async mkdirp(path: string): Promise<void> {
    this.setDir(path);
  }

  async readFile(): Promise<Buffer> {
    return Buffer.from('');
  }

  async writeFile(path: string, data: Buffer | string): Promise<void> {
    const size = typeof data === 'string' ? data.length : data.length;
    this.setFile(path, size);
  }

  async copyFile(source: string, target: string): Promise<void> {
    const entry = this.files.get(source);
    if (!entry) {
      throw new Error('missing');
    }
    this.files.set(target, { ...entry });
  }

  async unlink(path: string): Promise<void> {
    this.files.delete(path);
  }

  async rename(source: string, target: string): Promise<void> {
    const entry = this.files.get(source);
    if (entry) {
      this.files.set(target, entry);
      this.files.delete(source);
    }
  }

  async chmod(): Promise<void> {
    return;
  }
}

class NullLogger implements Logger {
  log(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  success(): void {}
}

class FakeDownloader implements Downloader {
  calls: number = 0;
  async download(): Promise<void> {
    this.calls += 1;
  }
}

class FakeZipExtractor implements ZipExtractor {
  calls: number = 0;
  constructor(private fileSystem: FakeFileSystem, private adbPath: string) {}

  async extract(): Promise<void> {
    this.calls += 1;
    this.fileSystem.setFile(this.adbPath, 100);
  }
}

class FakeVerifier implements Verifier {
  calls: number = 0;
  async verifyFile(): Promise<void> {
    this.calls += 1;
  }
}

class FakeFileLock implements FileLock {
  async acquire(): Promise<FileLockHandle> {
    return {
      release: async () => {},
    };
  }
}

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    adbPath: '',
    debugMode: false,
    showLogTime: true,
    packso: false,
    apkArchitectures: {},
    selectedDevice: '',
    customCommands: [],
    customFiles: [],
    customUrls: [],
    ...overrides,
  };
}

test('resolveAdb uses configured path when valid', async () => {
  const fileSystem = new FakeFileSystem();
  const logger = new NullLogger();
  const downloader = new FakeDownloader();
  const managedPath = ArtifactStore.getManagedAdbPath('darwin');
  const zipExtractor = new FakeZipExtractor(fileSystem, managedPath);
  const verifier = new FakeVerifier();
  const fileLock = new FakeFileLock();
  const store = new ArtifactStore(
    'darwin',
    fileSystem,
    logger,
    downloader,
    zipExtractor,
    verifier,
    fileLock,
  );

  fileSystem.setFile('/custom/adb', 50);
  const settings = createSettings({ adbPath: '/custom/adb' });
  const result = await store.resolveAdb(settings);

  assert.equal(result.path, '/custom/adb');
  assert.equal(result.managed, false);
  assert.equal(downloader.calls, 0);
});

test('resolveAdb falls back to managed path when config invalid', async () => {
  const fileSystem = new FakeFileSystem();
  const logger = new NullLogger();
  const downloader = new FakeDownloader();
  const managedPath = ArtifactStore.getManagedAdbPath('darwin');
  const zipExtractor = new FakeZipExtractor(fileSystem, managedPath);
  const verifier = new FakeVerifier();
  const fileLock = new FakeFileLock();
  const store = new ArtifactStore(
    'darwin',
    fileSystem,
    logger,
    downloader,
    zipExtractor,
    verifier,
    fileLock,
  );

  fileSystem.setFile(managedPath, 50);
  const settings = createSettings({ adbPath: '/invalid/adb' });
  const result = await store.resolveAdb(settings);

  assert.equal(result.path, managedPath);
  assert.equal(result.managed, true);
  assert.equal(downloader.calls, 0);
});

test('resolveAdb triggers install when managed path missing', async () => {
  const fileSystem = new FakeFileSystem();
  const logger = new NullLogger();
  const downloader = new FakeDownloader();
  const managedPath = ArtifactStore.getManagedAdbPath('darwin');
  const zipExtractor = new FakeZipExtractor(fileSystem, managedPath);
  const verifier = new FakeVerifier();
  const fileLock = new FakeFileLock();
  const store = new ArtifactStore(
    'darwin',
    fileSystem,
    logger,
    downloader,
    zipExtractor,
    verifier,
    fileLock,
  );

  const settings = createSettings({ adbPath: '' });
  const result = await store.resolveAdb(settings);

  assert.equal(result.path, managedPath);
  assert.equal(result.managed, true);
  assert.equal(downloader.calls, 1);
  assert.equal(zipExtractor.calls, 1);
  assert.equal(verifier.calls, 1);
});
