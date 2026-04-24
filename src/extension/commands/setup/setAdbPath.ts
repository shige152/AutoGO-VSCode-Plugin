import * as vscode from 'vscode';

export function registerSetAdbPathCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.setADBPath', handler);
}
