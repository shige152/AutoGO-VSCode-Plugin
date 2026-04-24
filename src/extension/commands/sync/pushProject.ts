import * as vscode from 'vscode';

export function registerPushCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.push', handler);
}
