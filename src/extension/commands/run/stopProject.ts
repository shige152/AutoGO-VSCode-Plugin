import * as vscode from 'vscode';

export function registerStopCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.stop', handler);
}
