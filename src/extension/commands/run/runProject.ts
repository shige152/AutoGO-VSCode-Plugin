import * as vscode from 'vscode';

export function registerRunCommand(handler: (...args: unknown[]) => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.run', handler);
}
