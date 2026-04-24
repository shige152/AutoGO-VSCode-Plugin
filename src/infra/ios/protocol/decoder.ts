/**
 * iOS 调试协议消息解码器
 * 将二进制帧格式解码为消息对象
 */

import { MessageType, AckError, FRAME_HEADER_SIZE } from './messageTypes';

export interface DecodedMessage {
  type: MessageType;
  payload: Buffer;
}

export interface FileAckMessage {
  success: boolean;
  error?: string;
}

export interface SyncDoneAckMessage {
  success: boolean;
}

export interface LogMessage {
  log: string;
}

export interface ExitMessage {
  exitCode: number;
}

export class MessageDecoder {
  private buffer: Buffer = Buffer.alloc(0);

  /**
   * 追加数据到解码缓冲区
   */
  append(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
  }

  /**
   * 尝试解码一个完整的帧
   * @returns 解码后的消息，如果没有完整帧则返回 null
   */
  decode(): DecodedMessage | null {
    if (this.buffer.length < FRAME_HEADER_SIZE) {
      return null;
    }

    const type = this.buffer.readUInt8(0);
    const payloadLen = this.buffer.readUInt32BE(1);
    const frameLen = FRAME_HEADER_SIZE + payloadLen;

    if (this.buffer.length < frameLen) {
      return null;
    }

    const payload = this.buffer.slice(FRAME_HEADER_SIZE, frameLen);
    this.buffer = this.buffer.slice(frameLen);

    return { type, payload };
  }

  /**
   * 解码 MSG_FILE_ACK 消息
   */
  static decodeFileAck(payload: Buffer): FileAckMessage {
    const response = payload.toString('utf-8');
    return {
      success: response === AckError.OK,
      error: response !== AckError.OK ? response : undefined,
    };
  }

  /**
   * 解码 MSG_SYNC_DONE_ACK 消息
   */
  static decodeSyncDoneAck(payload: Buffer): SyncDoneAckMessage {
    const response = payload.toString('utf-8');
    return {
      success: response === 'OK',
    };
  }

  /**
   * 解码 MSG_LOG 消息
   */
  static decodeLog(payload: Buffer): LogMessage {
    return {
      log: payload.toString('utf-8'),
    };
  }

  /**
   * 解码 MSG_EXIT 消息
   */
  static decodeExit(payload: Buffer): ExitMessage {
    const exitCodeStr = payload.toString('utf-8');
    return {
      exitCode: parseInt(exitCodeStr, 10) || 0,
    };
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.buffer = Buffer.alloc(0);
  }
}
