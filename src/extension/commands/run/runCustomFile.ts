import * as vscode from 'vscode';

export function registerRunCustomFileCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.runCustomFile', handler);
}
