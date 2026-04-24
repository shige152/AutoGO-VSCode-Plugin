export interface FileLockHandle {
  release(): Promise<void>;
}

export interface FileLockOptions {
  timeoutMs: number;
}

export interface FileLock {
  acquire(lockPath: string, options: FileLockOptions): Promise<FileLockHandle>;
}
