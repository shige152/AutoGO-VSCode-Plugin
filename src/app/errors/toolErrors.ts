export class AppError extends Error {
  readonly code: string;
  readonly hint?: string;
  readonly cause?: unknown;

  constructor(code: string, message: string, hint?: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.hint = hint;
    this.cause = cause;
  }
}

export class ToolNotReadyError extends AppError {
  readonly toolId: string;

  constructor(toolId: string, message: string, hint?: string, cause?: unknown) {
    super('TOOL_NOT_READY', message, hint, cause);
    this.toolId = toolId;
  }
}

export class ToolInstallError extends AppError {
  readonly toolId: string;
  readonly stage: string;
  readonly path?: string;

  constructor(toolId: string, stage: string, message: string, path?: string, cause?: unknown) {
    super('TOOL_INSTALL_FAILED', message, undefined, cause);
    this.toolId = toolId;
    this.stage = stage;
    this.path = path;
  }
}

export class LockTimeoutError extends AppError {
  readonly lockPath: string;

  constructor(lockPath: string, timeoutMs: number) {
    super('LOCK_TIMEOUT', `Lock timeout after ${timeoutMs}ms: ${lockPath}`);
    this.lockPath = lockPath;
  }
}
