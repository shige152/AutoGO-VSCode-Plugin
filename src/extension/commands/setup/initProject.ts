import * as vscode from 'vscode';

export function registerInitCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.init', handler);
}
