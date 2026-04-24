/**
 * iOS 调试协议消息编码器
 * 将消息对象编码为二进制帧格式
 */

import { MessageType, FRAME_HEADER_SIZE } from './messageTypes';

export class MessageEncoder {
  /**
   * 编码 MSG_PUSH_FILE 消息
   * @param remotePath 远程路径 (UTF-8)
   * @param fileData 文件二进制数据
   */
  static encodePushFile(remotePath: string, fileData: Buffer): Buffer {
    const pathBuffer = Buffer.from(remotePath, 'utf-8');
    const pathLen = pathBuffer.length;
    const payloadLen = 2 + pathLen + fileData.length;

    // 构建帧: type(1) + payloadLen(4) + pathLen(2) + path(N) + fileData(M)
    const frame = Buffer.alloc(FRAME_HEADER_SIZE + payloadLen);
    let offset = 0;

    // type (1 byte)
    frame.writeUInt8(MessageType.MSG_PUSH_FILE, offset);
    offset += 1;

    // payloadLen (4 bytes, 大端序)
    frame.writeUInt32BE(payloadLen, offset);
    offset += 4;

    // pathLen (2 bytes, 大端序)
    frame.writeUInt16BE(pathLen, offset);
    offset += 2;

    // path (N bytes)
    pathBuffer.copy(frame, offset);
    offset += pathLen;

    // fileData (M bytes)
    fileData.copy(frame, offset);

    return frame;
  }

  /**
   * 编码 MSG_SYNC_DONE 消息
   */
  static encodeSyncDone(): Buffer {
    const frame = Buffer.alloc(FRAME_HEADER_SIZE);
    frame.writeUInt8(MessageType.MSG_SYNC_DONE, 0);
    frame.writeUInt32BE(0, 1); // payloadLen = 0
    return frame;
  }

  /**
   * 编码 MSG_RUN 消息
   * @param mode 运行模式: 'zip' 或 'bin'
   */
  static encodeRun(mode: 'zip' | 'bin'): Buffer {
    const payload = Buffer.from(mode, 'utf-8');
    const frame = Buffer.alloc(FRAME_HEADER_SIZE + payload.length);

    frame.writeUInt8(MessageType.MSG_RUN, 0);
    frame.writeUInt32BE(payload.length, 1);
    payload.copy(frame, FRAME_HEADER_SIZE);

    return frame;
  }

  /**
   * 编码 MSG_STOP 消息
   */
  static encodeStop(): Buffer {
    const frame = Buffer.alloc(FRAME_HEADER_SIZE);
    frame.writeUInt8(MessageType.MSG_STOP, 0);
    frame.writeUInt32BE(0, 1); // payloadLen = 0
    return frame;
  }
}
