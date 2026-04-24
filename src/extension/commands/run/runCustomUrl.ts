import * as vscode from 'vscode';

export function registerRunCustomUrlCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.runCustomUrl', handler);
}
