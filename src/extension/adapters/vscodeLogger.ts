import { Logger } from '../../app/ports/logger';
import { OutputChannel } from '../../services/outputChannel';

export class VscodeLogger implements Logger {
  constructor(private readonly outputChannel: OutputChannel) {}

  log(message: string): void {
    this.outputChannel.log(message);
  }

  info(message: string): void {
    this.outputChannel.info(message);
  }

  warn(message: string): void {
    this.outputChannel.warn(message);
  }

  error(message: string): void {
    this.outputChannel.error(message);
  }

  success(message: string): void {
    this.outputChannel.success(message);
  }
}
