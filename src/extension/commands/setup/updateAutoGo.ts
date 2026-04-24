import * as vscode from 'vscode';

export function registerUpdateAutoGoCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.updateAutoGo', handler);
}
