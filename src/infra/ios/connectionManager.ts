/**
 * iOS 设备连接管理器
 * 管理多个 iOS 设备的连接状态
 */

import { NodeIosDebugClient } from './iosDebugClient';
import { IosDeviceConfig } from '../../app/ports/iosDebugClient';

export interface ConnectedDevice {
  id: string;
  config: IosDeviceConfig;
  client: NodeIosDebugClient;
  connectedAt: Date;
}

export class IosConnectionManager {
  private devices: Map<string, ConnectedDevice> = new Map();

  /**
   * 连接到 iOS 设备
   * @param id 设备标识（如 IP 地址）
   * @param config 设备配置
   */
  async connect(id: string, config: IosDeviceConfig): Promise<void> {
    // 如果已存在连接，先断开
    if (this.devices.has(id)) {
      await this.disconnect(id);
    }

    const client = new NodeIosDebugClient();
    await client.connect(config);

    const device: ConnectedDevice = {
      id,
      config,
      client,
      connectedAt: new Date(),
    };

    this.devices.set(id, device);
  }

  /**
   * 断开指定设备的连接
   */
  async disconnect(id: string): Promise<void> {
    const device = this.devices.get(id);
    if (device) {
      device.client.disconnect();
      this.devices.delete(id);
    }
  }

  /**
   * 断开所有设备连接
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.devices.keys()).map((id) =>
      this.disconnect(id)
    );
    await Promise.all(disconnectPromises);
  }

  /**
   * 获取指定设备的客户端
   */
  getClient(id: string): NodeIosDebugClient | undefined {
    return this.devices.get(id)?.client;
  }

  /**
   * 获取所有已连接设备
   */
  getAllDevices(): ConnectedDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * 检查设备是否已连接
   */
  isConnected(id: string): boolean {
    const device = this.devices.get(id);
    return device?.client.isConnected() ?? false;
  }

  /**
   * 获取当前选中的设备（默认返回第一个连接的设备）
   */
  getSelectedDevice(): ConnectedDevice | undefined {
    return this.getAllDevices()[0];
  }
}

// 导出单例实例
export const iosConnectionManager = new IosConnectionManager();
