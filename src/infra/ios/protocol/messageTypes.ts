/**
 * iOS 调试协议消息类型定义
 * 对应协议文档第3节
 */

export enum MessageType {
  /** 推送文件 IDE → 设备 */
  MSG_PUSH_FILE = 0x01,
  /** 文件推送/运行启动结果 设备 → IDE */
  MSG_FILE_ACK = 0x02,
  /** 文件同步完成通知 IDE → 设备 */
  MSG_SYNC_DONE = 0x03,
  /** 同步完成确认 设备 → IDE */
  MSG_SYNC_DONE_ACK = 0x04,
  /** 启动脚本运行 IDE → 设备 */
  MSG_RUN = 0x05,
  /** 停止运行中的脚本 IDE → 设备 */
  MSG_STOP = 0x06,
  /** 脚本日志输出 设备 → IDE */
  MSG_LOG = 0x07,
  /** 脚本进程退出 设备 → IDE */
  MSG_EXIT = 0x08,
}

/** 文件推送/运行响应的错误码 */
export enum AckError {
  OK = 'OK',
  INVALID_PATH = 'ERR:invalid path',
  OPEN_FAILED = 'ERR:open failed',
  BINARY_NOT_FOUND = 'ERR:binary not found',
  LIBGOEVAL_NOT_FOUND = 'ERR:libgoeval.dylib not found',
  ZIP_NOT_FOUND = 'ERR:ios-debug.zip not found',
  SIGN_FAILED = 'ERR:sign failed',
  SPAWN_FAILED = 'ERR:spawn failed',
}

/** 帧头大小: type(1) + payloadLen(4) */
export const FRAME_HEADER_SIZE = 5;

/** 最大日志行长度 */
export const MAX_LOG_LINE_LENGTH = 4096;

/** 默认 iOS 调试端口 */
export const DEFAULT_IOS_DEBUG_PORT = 8820;

/** HTTP 辅助接口端口 */
export const DEFAULT_IOS_HTTP_PORT = 8989;
