export interface Settings {
  adbPath: string;
  debugMode: boolean;
  showLogTime: boolean;
  packso: boolean;
  codeObfuscation: boolean;
  apkArchitectures: Record<string, boolean>;
  selectedDevice: string;
  customCommands: { label: string; command: string }[];
  customFiles: { label: string; path: string }[];
  customUrls: { label: string; url: string }[];
}
