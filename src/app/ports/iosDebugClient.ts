/**
 * iOS 调试客户端接口定义
 * 定义与 iOS 设备通信的核心能力
 */

export interface IosDeviceConfig {
  host: string;
  port: number;
}

export interface FilePushResult {
  success: boolean;
  error?: string;
}

export interface RunResult {
  success: boolean;
  error?: string;
}

export type LogHandler = (log: string) => void;
export type ExitHandler = (exitCode: number) => void;

export interface IosDebugClient {
  /**
   * 连接到 iOS 设备
   */
  connect(config: IosDeviceConfig): Promise<void>;

  /**
   * 断开连接
   */
  disconnect(): void;

  /**
   * 是否已连接
   */
  isConnected(): boolean;

  /**
   * 推送文件到设备
   * @param remotePath 远程路径标识 (如 'debug', 'ios-debug.zip', 'assets/xxx')
   * @param fileData 文件二进制数据
   */
  pushFile(remotePath: string, fileData: Buffer): Promise<FilePushResult>;

  /**
   * 通知设备文件同步完成
   */
  syncDone(): Promise<boolean>;

  /**
   * 启动脚本运行
   * @param mode 运行模式: 'zip' (eval模式) 或 'bin' (二进制模式)
   */
  runScript(mode: 'zip' | 'bin'): Promise<RunResult>;

  /**
   * 停止当前运行的脚本
   */
  stopScript(): void;

  /**
   * 设置日志接收处理器
   */
  onLog(handler: LogHandler): void;

  /**
   * 设置进程退出处理器
   */
  onExit(handler: ExitHandler): void;

  /**
   * 移除日志处理器
   */
  offLog(handler: LogHandler): void;

  /**
   * 移除退出处理器
   */
  offExit(handler: ExitHandler): void;

  /**
   * 清空所有日志处理器
   */
  clearLogHandlers(): void;

  /**
   * 清空所有退出处理器
   */
  clearExitHandlers(): void;
}

export const IIosDebugClient = Symbol('IIosDebugClient');
