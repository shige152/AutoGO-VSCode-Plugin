import * as vscode from 'vscode';

export function registerPushFileCommand(handler: (uri?: vscode.Uri) => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.pushFile', handler);
}
