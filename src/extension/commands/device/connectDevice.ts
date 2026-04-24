import * as vscode from 'vscode';

export function registerConnectCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.connect', handler);
}
