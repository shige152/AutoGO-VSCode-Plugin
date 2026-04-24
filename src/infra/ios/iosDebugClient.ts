/**
 * iOS 调试客户端实现
 * 基于 TCP 协议与 iOS 设备通信
 */

import * as net from 'net';
import {
  IosDebugClient,
  IosDeviceConfig,
  FilePushResult,
  RunResult,
  LogHandler,
  ExitHandler,
} from '../../app/ports/iosDebugClient';
import { MessageType } from './protocol/messageTypes';
import { MessageEncoder } from './protocol/encoder';
import { MessageDecoder, DecodedMessage } from './protocol/decoder';

export class NodeIosDebugClient implements IosDebugClient {
  private socket: net.Socket | null = null;
  private decoder = new MessageDecoder();
  private logHandlers: Set<LogHandler> = new Set();
  private exitHandlers: Set<ExitHandler> = new Set();
  private pendingAcks: Map<
    MessageType,
    { resolve: (value: boolean) => void; reject: (reason: Error) => void; timeout: NodeJS.Timeout }
  > = new Map();

  /**
   * 连接到 iOS 设备
   */
  async connect(config: IosDeviceConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket) {
        reject(new Error('已经连接到设备'));
        return;
      }

      this.socket = new net.Socket();

      // 设置 TCP keepalive
      this.socket.setKeepAlive(true, 60000);

      this.socket.on('connect', () => {
        resolve();
      });

      this.socket.on('error', (err) => {
        reject(err);
      });

      this.socket.on('close', () => {
        this.cleanup();
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.connect(config.port, config.host);
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
    this.cleanup();
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  /**
   * 推送文件到设备
   */
  async pushFile(remotePath: string, fileData: Buffer): Promise<FilePushResult> {
    if (!this.isConnected()) {
      return { success: false, error: '未连接到设备' };
    }

    const frame = MessageEncoder.encodePushFile(remotePath, fileData);

    try {
      await this.sendFrame(frame);
      const ack = await this.waitForAck(MessageType.MSG_FILE_ACK, 30000);

      return {
        success: ack.success,
        error: ack.error,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 通知设备文件同步完成
   */
  async syncDone(): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    const frame = MessageEncoder.encodeSyncDone();

    try {
      await this.sendFrame(frame);
      const ack = await this.waitForAck(MessageType.MSG_SYNC_DONE_ACK, 10000);
      return ack.success;
    } catch {
      return false;
    }
  }

  /**
   * 启动脚本运行
   */
  async runScript(mode: 'zip' | 'bin'): Promise<RunResult> {
    if (!this.isConnected()) {
      return { success: false, error: '未连接到设备' };
    }

    const frame = MessageEncoder.encodeRun(mode);

    try {
      await this.sendFrame(frame);
      const ack = await this.waitForAck(MessageType.MSG_FILE_ACK, 15000);

      return {
        success: ack.success,
        error: ack.error,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 停止当前运行的脚本
   */
  stopScript(): void {
    if (!this.isConnected()) {
      return;
    }

    const frame = MessageEncoder.encodeStop();
    this.sendFrame(frame).catch(() => {});
  }

  /**
   * 设置日志接收处理器
   */
  onLog(handler: LogHandler): void {
    this.logHandlers.add(handler);
  }

  /**
   * 设置进程退出处理器
   */
  onExit(handler: ExitHandler): void {
    this.exitHandlers.add(handler);
  }

  /**
   * 移除日志处理器
   */
  offLog(handler: LogHandler): void {
    this.logHandlers.delete(handler);
  }

  /**
   * 移除退出处理器
   */
  offExit(handler: ExitHandler): void {
    this.exitHandlers.delete(handler);
  }

  /**
   * 清空所有日志处理器
   */
  clearLogHandlers(): void {
    this.logHandlers.clear();
  }

  /**
   * 清空所有退出处理器
   */
  clearExitHandlers(): void {
    this.exitHandlers.clear();
  }

  /**
   * 发送帧数据
   */
  private async sendFrame(frame: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('未连接到设备'));
        return;
      }

      this.socket.write(frame, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 等待 ACK 响应
   */
  private waitForAck(
    expectedType: MessageType,
    timeoutMs: number
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingAcks.delete(expectedType);
        reject(new Error('等待响应超时'));
      }, timeoutMs);

      this.pendingAcks.set(expectedType, {
        resolve: (success: boolean) => resolve({ success }),
        reject,
        timeout,
      });
    });
  }

  /**
   * 处理接收到的数据
   */
  private handleData(data: Buffer): void {
    this.decoder.append(data);

    let message: DecodedMessage | null;
    while ((message = this.decoder.decode()) !== null) {
      this.handleMessage(message);
    }
  }

  /**
   * 处理解码后的消息
   */
  private handleMessage(message: DecodedMessage): void {
    const { MessageDecoder } = require('./protocol/decoder');

    switch (message.type) {
      case MessageType.MSG_FILE_ACK: {
        const ack = MessageDecoder.decodeFileAck(message.payload);
        const pending = this.pendingAcks.get(MessageType.MSG_FILE_ACK);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingAcks.delete(MessageType.MSG_FILE_ACK);
          pending.resolve(ack.success);
        }
        break;
      }

      case MessageType.MSG_SYNC_DONE_ACK: {
        const ack = MessageDecoder.decodeSyncDoneAck(message.payload);
        const pending = this.pendingAcks.get(MessageType.MSG_SYNC_DONE_ACK);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingAcks.delete(MessageType.MSG_SYNC_DONE_ACK);
          pending.resolve(ack.success);
        }
        break;
      }

      case MessageType.MSG_LOG: {
        const logMsg = MessageDecoder.decodeLog(message.payload);
        this.logHandlers.forEach((handler) => handler(logMsg.log));
        break;
      }

      case MessageType.MSG_EXIT: {
        const exitMsg = MessageDecoder.decodeExit(message.payload);
        this.exitHandlers.forEach((handler) => handler(exitMsg.exitCode));
        break;
      }
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.decoder.clear();

    // 清理所有等待中的 ACK
    this.pendingAcks.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('连接已断开'));
    });
    this.pendingAcks.clear();

    this.socket = null;
  }
}
