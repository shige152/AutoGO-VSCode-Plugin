import * as child_process from 'child_process';
import { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../app/ports/processRunner';

export class NodeProcessRunner implements ProcessRunner {
  run(command: string, args: string[], options: ProcessRunOptions = {}): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const child = child_process.spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code ?? -1,
          stdout,
          stderr,
        });
      });
    });
  }
}
