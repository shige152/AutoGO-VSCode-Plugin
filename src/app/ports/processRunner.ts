export interface ProcessRunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ProcessRunner {
  run(command: string, args: string[], options?: ProcessRunOptions): Promise<ProcessResult>;
}
