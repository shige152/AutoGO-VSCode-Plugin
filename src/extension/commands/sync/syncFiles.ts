import * as vscode from 'vscode';

export function registerSyncFilesCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.syncFiles', handler);
}
