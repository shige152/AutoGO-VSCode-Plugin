export type SupportedPlatform = 'win32' | 'darwin';

const WINDOWS_PUBLIC = 'C:\\Users\\Public';
const MAC_PUBLIC = '/Users/Shared';

function getPublicDir(platform: SupportedPlatform): string {
  if (platform === 'win32') {
    return WINDOWS_PUBLIC;
  }
  if (platform === 'darwin') {
    return MAC_PUBLIC;
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

export function getAgExecutablePath(platform: SupportedPlatform): string {
  if (platform === 'win32') {
    return `${WINDOWS_PUBLIC}\\ag.exe`;
  }
  return `${MAC_PUBLIC}/ag`;
}

export function getAdbZipPath(platform: SupportedPlatform): string {
  if (platform === 'win32') {
    return `${WINDOWS_PUBLIC}\\ADB-platform-tools-latest-windows.zip`;
  }
  return `${MAC_PUBLIC}/ADB-platform-tools-latest-darwin.zip`;
}

export function getAdbInstallDir(platform: SupportedPlatform): string {
  if (platform === 'win32') {
    return `${WINDOWS_PUBLIC}\\ADB-platform-tools`;
  }
  return `${MAC_PUBLIC}/ADB-platform-tools`;
}

export function getAdbExecutablePath(platform: SupportedPlatform): string {
  if (platform === 'win32') {
    return `${WINDOWS_PUBLIC}\\ADB-platform-tools\\adb.exe`;
  }
  return `${MAC_PUBLIC}/ADB-platform-tools/adb`;
}

export function getToolLockPath(toolId: string, platform: SupportedPlatform): string {
  const baseDir = getPublicDir(platform);
  const separator = platform === 'win32' ? '\\' : '/';
  return `${baseDir}${separator}.autogo.${toolId}.lock`;
}


