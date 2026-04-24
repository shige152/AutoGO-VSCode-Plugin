import * as vscode from 'vscode';

export function registerRunCustomCommandCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.runCustomCommand', handler);
}
