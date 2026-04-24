import { AdbService } from '../../../services/adbService';
import { ConfigService } from '../../../services/configService';
import { OutputChannel } from '../../../services/outputChannel';

export type DeviceConnectionStatus = 'connected' | 'not_connected' | 'check_failed';

export async function checkDeviceConnection(
  adbService: AdbService,
  outputChannel: OutputChannel,
  targetDevice: string,
  configService: ConfigService,
  adbPath?: string
): Promise<DeviceConnectionStatus> {
  const debugMode = configService.debugMode;
  if (!targetDevice) {
    outputChannel.warn('checkDeviceConnection called with empty targetDevice.');
    return 'not_connected';
  }
  try {
    const devices = await adbService.getDevices(adbPath);
    if (debugMode) {
      outputChannel.log(`[Debug] Available devices: ${devices.join(', ')}`);
    }

    if (devices.includes(targetDevice)) {
      if (debugMode) {
        outputChannel.log(`[Debug] Target device ${targetDevice} is connected.`);
      }
      return 'connected';
    }

    if (debugMode) {
      outputChannel.log(`[Debug] Target device ${targetDevice} is not in the list of connected devices.`);
    }
    return 'not_connected';
  } catch (error) {
    outputChannel.error(
      `Error during device check for ${targetDevice}: ${error instanceof Error ? error.message : String(error)}`
    );
    return 'check_failed';
  }
}
