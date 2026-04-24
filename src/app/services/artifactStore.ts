import { getAdbExecutablePath, getAdbInstallDir, getAdbZipPath, getAgExecutablePath, getToolLockPath, SupportedPlatform } from '../../core/tooling/toolPaths';
import { Downloader } from '../ports/downloader';
import { FileLock } from '../ports/fileLock';
import { FileSystem } from '../ports/fileSystem';
import { Logger } from '../ports/logger';
import { Settings } from '../ports/settings';
import { Verifier } from '../ports/verifier';
import { ZipExtractor } from '../ports/zipExtractor';
import { LockTimeoutError, ToolInstallError, ToolNotReadyError } from '../errors/toolErrors';

export interface ResolvedTool {
  path: string;
  managed: boolean;
}

export class ArtifactStore {
  constructor(
    private readonly platform: SupportedPlatform,
    private readonly fileSystem: FileSystem,
    private readonly logger: Logger,
    private readonly downloader: Downloader,
    private readonly zipExtractor: ZipExtractor,
    private readonly verifier: Verifier,
    private readonly fileLock: FileLock,
  ) {}

  static getManagedAgPath(platform: SupportedPlatform): string {
    return getAgExecutablePath(platform);
  }

  static getManagedAdbPath(platform: SupportedPlatform): string {
    return getAdbExecutablePath(platform);
  }

  async resolveAg(): Promise<ResolvedTool> {
    const agPath = getAgExecutablePath(this.platform);
    const valid = await this.isValidFile(agPath);
    if (!valid) {
      this.logger.error(`AG not found at ${agPath}`);
      throw new ToolNotReadyError('ag', 'AG is not installed', 'Use update command to install AG.');
    }
    return { path: agPath, managed: true };
  }

  getManagedAgPath(): string {
    return getAgExecutablePath(this.platform);
  }

  getManagedAdbPath(): string {
    return getAdbExecutablePath(this.platform);
  }

  async isValidPath(path: string): Promise<boolean> {
    return this.isValidFile(path);
  }

  async isManagedAdbReady(): Promise<boolean> {
    return this.isValidFile(getAdbExecutablePath(this.platform));
  }

  async ensureAgInstalled(): Promise<ResolvedTool> {
    return this.resolveAg();
  }

  async resolveAdb(settings: Settings): Promise<ResolvedTool> {
    const configuredPath = settings.adbPath.trim();
    if (configuredPath) {
      const valid = await this.isValidFile(configuredPath);
      if (valid) {
        if (settings.debugMode) {
          this.logger.info(`使用 ADB 路径: ${configuredPath}`);
        }
        return { path: configuredPath, managed: false };
      }
      this.logger.warn(`配置的 ADB 路径无效: ${configuredPath}`);
    }

    return this.ensureAdbInstalled();
  }

  async ensureAdbInstalled(): Promise<ResolvedTool> {
    const adbPath = getAdbExecutablePath(this.platform);
    const lockPath = getToolLockPath('adb', this.platform);
    const zipPath = getAdbZipPath(this.platform);
    const installDir = getAdbInstallDir(this.platform);
    let lockHandle;
    const downloadZip = async (): Promise<void> => {
      this.logger.info(`正在下载 ADB 到 ${zipPath}`);
      try {
        await this.downloader.download(this.getAdbDownloadUrl(), zipPath);
      } catch (error) {
        throw new ToolInstallError('adb', 'download', '下载 ADB 失败', zipPath, error);
      }
    };
    const extractZip = async (): Promise<void> => {
      try {
        await this.zipExtractor.extract(zipPath, installDir, {
          stripPrefix: 'platform-tools/',
          requirePrefix: true,
        });
      } catch (error) {
        throw new ToolInstallError('adb', 'extract', '解压 ADB 失败', installDir, error);
      }
    };
    const verifyAdb = async (): Promise<void> => {
      try {
        await this.verifier.verifyFile(adbPath, { chmodExecutable: this.platform === 'darwin' });
      } catch (error) {
        throw new ToolInstallError('adb', 'verify', 'ADB 校验失败', adbPath, error);
      }
    };

    try {
      lockHandle = await this.fileLock.acquire(lockPath, { timeoutMs: 5 * 60 * 1000 });
    } catch (error) {
      throw new LockTimeoutError(lockPath, 5 * 60 * 1000);
    }

    try {
      const existing = await this.isValidFile(adbPath);
      if (existing) {
        return { path: adbPath, managed: true };
      }

      const zipReady = await this.isValidFile(zipPath);
      if (zipReady) {
        this.logger.info(`使用缓存的 ADB 压缩包: ${zipPath}`);
      } else {
        await downloadZip();
      }

      try {
        await extractZip();
        await verifyAdb();
      } catch (error) {
        if (!zipReady) {
          throw error;
        }
        this.logger.warn(`缓存的 ADB 压缩包不可用，重新下载: ${zipPath}`);
        await downloadZip();
        await extractZip();
        await verifyAdb();
      }

      return { path: adbPath, managed: true };
    } finally {
      await lockHandle?.release();
    }
  }

  private async isValidFile(path: string): Promise<boolean> {
    const exists = await this.fileSystem.exists(path);
    if (!exists) {
      return false;
    }
    const stats = await this.fileSystem.stat(path);
    if (stats.isDirectory()) {
      return false;
    }
    return stats.size > 0;
  }

  private getAdbDownloadUrl(): string {
    if (this.platform === 'win32') {
      return 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip';
    }
    return 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip';
  }
}
