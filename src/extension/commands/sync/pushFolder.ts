import * as vscode from 'vscode';

export function registerPushFolderCommand(handler: (uri?: vscode.Uri) => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.pushFolder', handler);
}
