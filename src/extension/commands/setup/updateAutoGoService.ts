import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { OutputChannel } from '../../../services/outputChannel';
import { ConfigService } from '../../../services/configService';

const MAX_REDIRECTS = 5;

export interface VersionInfo {
  version: string;
  date: string;
  changes: string[];
  cached: boolean;
}

export class UpdateAutoGoService {
  constructor(
    private readonly outputChannel: OutputChannel,
    private readonly configService: ConfigService,
  ) {}

  async getLocalVersion(agPath: string): Promise<string | null> {
    if (!fs.existsSync(agPath)) {
      return null;
    }

    try {
      const result = child_process.spawnSync(agPath, ['version'], { encoding: 'utf8' });
      if (result.status !== 0) {
        return null;
      }
      const match = result.stdout.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      if (this.configService.debugMode) {
        this.outputChannel.error(`获取本地版本失败: ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    }
  }

  async fetchVersions(): Promise<VersionInfo[]> {
    const changelogUrl = this.getRequiredUrl('sdkChangelogUrl', '\u66f4\u65b0\u65e5\u5fd7\u5730\u5740');
    const changelog = await this.httpGetText(changelogUrl, 10000);
    const versions = this.parseVersions(changelog);
    if (versions.length === 0) {
      return [];
    }

    const cacheDir = this.getDownloadCacheDir();
    const results: VersionInfo[] = [];

    for (const version of versions) {
      const cachedPath = path.join(cacheDir, this.getVersionedFileName(version.version));
      const cached = fs.existsSync(cachedPath);
      results.push({ ...version, cached });
    }

    return results;
  }

  async downloadAndInstall(version: string, agExecutablePath: string, workspaceDir?: string): Promise<void> {
    const cacheDir = this.getDownloadCacheDir();
    await this.mkdirp(cacheDir);

    const cachedFilePath = path.join(cacheDir, this.getVersionedFileName(version));
    const tmpDownloadPath = `${cachedFilePath}.tmp`;

    if (!fs.existsSync(cachedFilePath)) {
      const downloadUrl = this.getDownloadUrl(version);
      this.outputChannel.log(`\u5f00\u59cb\u4e0b\u8f7d v${version}...`);
      await this.downloadWithProgress(downloadUrl, tmpDownloadPath);

      if (fs.existsSync(cachedFilePath)) {
        fs.unlinkSync(cachedFilePath);
      }
      fs.renameSync(tmpDownloadPath, cachedFilePath);
      this.outputChannel.success('\u4e0b\u8f7d\u5b8c\u6210');
    }

    await this.installFromCache(cachedFilePath, agExecutablePath);

    if (process.platform !== 'win32') {
      fs.chmodSync(agExecutablePath, 0o755);
      fs.chmodSync(cachedFilePath, 0o755);
    }

    this.outputChannel.success(`\u5df2\u5207\u6362\u5230 v${version}`);
    await this.silentInitProject(agExecutablePath, workspaceDir);
  }

  private getRequiredUrl(key: 'sdkChangelogUrl' | 'sdkDownloadBaseUrl', label: string): string {
    const configuredValue = key === 'sdkChangelogUrl'
      ? this.configService.sdkChangelogUrl
      : this.configService.sdkDownloadBaseUrl;

    if (!configuredValue) {
      throw new Error(`\u672a\u914d\u7f6e AutoGo.${key}\uff0c\u65e0\u6cd5\u4f7f\u7528 SDK \u66f4\u65b0\u529f\u80fd\u3002\u8bf7\u5728\u8bbe\u7f6e\u4e2d\u63d0\u4f9b\u516c\u5f00\u7684${label}\u3002`);
    }

    let parsed: URL;
    try {
      parsed = new URL(configuredValue);
    } catch {
      throw new Error(`AutoGo.${key} \u914d\u7f6e\u65e0\u6548\uff1a${configuredValue}`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`AutoGo.${key} \u4ec5\u652f\u6301 http/https \u5730\u5740\uff1a${configuredValue}`);
    }

    return configuredValue;
  }

  private async httpGetText(url: string, timeoutMs: number, redirectCount = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { timeout: timeoutMs }, (res) => {
        const statusCode = res.statusCode ?? 0;
        const location = res.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location) {
          res.resume();
          if (redirectCount >= MAX_REDIRECTS) {
            reject(new Error(`\u91cd\u5b9a\u5411\u6b21\u6570\u8fc7\u591a\uff1a${url}`));
            return;
          }

          const redirectUrl = new URL(location, url).toString();
          this.httpGetText(redirectUrl, timeoutMs, redirectCount + 1).then(resolve).catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          reject(new Error(`\u8bf7\u6c42\u5931\u8d25 (${statusCode})\uff1a${url}`));
          return;
        }

        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  private async downloadWithProgress(url: string, destination: string, redirectCount = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      let file: fs.WriteStream | undefined;
      let settled = false;
      let cleanedUp = false;
      let lastPercent = -1;

      const cleanup = () => {
        if (cleanedUp) {
          return;
        }
        cleanedUp = true;
        file?.close();
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
      };

      const fail = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      };

      const succeed = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      const req = client.get(url, (res) => {
        const statusCode = res.statusCode ?? 0;
        const location = res.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location) {
          res.resume();
          if (redirectCount >= MAX_REDIRECTS) {
            fail(new Error(`\u91cd\u5b9a\u5411\u6b21\u6570\u8fc7\u591a\uff1a${url}`));
            return;
          }

          const redirectUrl = new URL(location, url).toString();
          this.downloadWithProgress(redirectUrl, destination, redirectCount + 1).then(succeed).catch(fail);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          fail(new Error(`\u4e0b\u8f7d\u5931\u8d25 (${statusCode})\uff1a${url}`));
          return;
        }

        file = fs.createWriteStream(destination);
        file.on('error', (error) => fail(error instanceof Error ? error : new Error(String(error))));

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let transferredBytes = 0;

        res.on('data', (chunk) => {
          transferredBytes += chunk.length;
          if (totalBytes) {
            const percent = Math.floor((transferredBytes / totalBytes) * 100);
            if (percent >= lastPercent + 5 || percent === 100) {
              this.outputChannel.log(`\u4e0b\u8f7d\u8fdb\u5ea6: ${percent}%`);
              lastPercent = percent;
            }
          }
        });

        res.on('error', (error) => fail(error instanceof Error ? error : new Error(String(error))));
        res.pipe(file);
        file.on('finish', () => {
          file?.close();
          succeed();
        });
      });

      req.on('error', (error) => fail(error instanceof Error ? error : new Error(String(error))));
    });
  }

  private async installFromCache(sourcePath: string, targetPath: string): Promise<void> {
    await this.mkdirp(path.dirname(targetPath));

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }

    fs.copyFileSync(sourcePath, targetPath);

    const sourceStats = fs.statSync(sourcePath);
    const targetStats = fs.statSync(targetPath);
    if (sourceStats.size !== targetStats.size) {
      throw new Error(`\u6587\u4ef6\u5927\u5c0f\u4e0d\u5339\u914d: ${sourceStats.size} bytes vs ${targetStats.size} bytes`);
    }
  }

  private async mkdirp(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private getDownloadCacheDir(): string {
    if (process.platform === 'win32') {
      return 'C:\\Users\\Public';
    }
    if (process.platform === 'darwin') {
      return '/Users/Shared';
    }
    throw new Error(`\u4e0d\u652f\u6301\u7684\u5e73\u53f0: ${process.platform}`);
  }

  private getVersionedFileName(version: string): string {
    if (process.platform === 'win32') {
      return `ag_${version}.exe`;
    }
    return `ag_${version}`;
  }

  private getDownloadUrl(version: string): string {
    const baseUrl = this.getRequiredUrl('sdkDownloadBaseUrl', 'SDK \u4e0b\u8f7d\u5730\u5740').replace(/\/+$/, '');

    if (process.platform === 'win32') {
      return `${baseUrl}/win_x64_${version}`;
    }

    if (process.platform === 'darwin') {
      const archString = process.arch === 'arm64' ? 'mac_arm' : 'mac_amd';
      return `${baseUrl}/${archString}_${version}`;
    }

    throw new Error(`\u4e0d\u652f\u6301\u7684\u5e73\u53f0: ${process.platform}`);
  }

  private parseVersions(changelog: string): Array<Omit<VersionInfo, 'cached'>> {
    const versions: Array<Omit<VersionInfo, 'cached'>> = [];
    const lines = changelog.split('\n');
    let currentVersion: Omit<VersionInfo, 'cached'> | null = null;

    const looseVersionPattern = /##.*?\[(\d+\.\d+\.\d+)\](?:.*?-\s*)?(.*)/;

    for (const line of lines) {
      const matcher = looseVersionPattern.exec(line);
      if (matcher) {
        currentVersion = {
          version: matcher[1],
          date: matcher[2].trim(),
          changes: [],
        };
        versions.push(currentVersion);
      } else if (currentVersion && line.trim().startsWith('-')) {
        currentVersion.changes.push(line.trim());
      }
    }

    return versions;
  }

  private async silentInitProject(agPath: string, workspaceDir?: string): Promise<void> {
    const cwd = workspaceDir || path.dirname(agPath);
    const targetPlatform = this.configService.targetPlatform;

    try {
      const result = child_process.spawnSync(agPath, ['init', '-t', targetPlatform], {
        cwd,
        encoding: 'utf8',
      });

      if (this.configService.debugMode && result.status !== 0) {
        this.outputChannel.error(`\u521d\u59cb\u5316\u5931\u8d25: ${result.stderr || result.stdout}`);
      }
    } catch (error) {
      if (this.configService.debugMode) {
        this.outputChannel.error(`\u521d\u59cb\u5316\u5931\u8d25: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
