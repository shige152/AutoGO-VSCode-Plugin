import { ConfigService } from '../services/configService';
import { OutputChannel } from '../services/outputChannel';

export async function resolveAdbPathForCommand(
  configService: ConfigService,
  outputChannel: OutputChannel,
): Promise<string | null> {
  const configuredPath = configService.get<string>('adbPath', '').trim();
  const configuredInvalid =
    configuredPath.length > 0 && !configService.isValidAdbPath(configuredPath);

  const resolvedPath = configService.adbPath.trim();
  const resolvedValid = resolvedPath.length > 0 && configService.isValidAdbPath(resolvedPath);
  if (resolvedValid) {
    return resolvedPath;
  }

  if (configuredInvalid) {
    outputChannel.warn(`配置的 ADB 路径无效: ${configuredPath}`);
  } else {
    outputChannel.warn('未检测到有效的 ADB，请在设置中配置 ADB 路径。');
  }

  return null;
}
