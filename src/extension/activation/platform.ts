import * as os from 'os';
import { SupportedPlatform } from '../../core/tooling/toolPaths';

export function getSupportedPlatform(): SupportedPlatform {
  const platform = os.platform();
  if (platform === 'win32' || platform === 'darwin') {
    return platform;
  }
  throw new Error(`Unsupported platform: ${platform}`);
}
