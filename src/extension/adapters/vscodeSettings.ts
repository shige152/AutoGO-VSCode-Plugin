import { Settings } from '../../app/ports/settings';
import { ConfigService } from '../../services/configService';

export class VscodeSettings implements Settings {
  constructor(private readonly configService: ConfigService) {}

  get adbPath(): string {
    return this.configService.adbPath;
  }

  get debugMode(): boolean {
    return this.configService.debugMode;
  }

  get showLogTime(): boolean {
    return this.configService.showLogTime;
  }

  get packso(): boolean {
    return this.configService.packso;
  }

  get codeObfuscation(): boolean {
    return this.configService.codeObfuscation;
  }

  get apkArchitectures(): Record<string, boolean> {
    return this.configService.apkArchitectures;
  }

  get selectedDevice(): string {
    return this.configService.selectedDevice;
  }

  get customCommands(): { label: string; command: string }[] {
    return this.configService.customCommands;
  }

  get customFiles(): { label: string; path: string }[] {
    return this.configService.customFiles;
  }

  get customUrls(): { label: string; url: string }[] {
    return this.configService.customUrls;
  }
}
