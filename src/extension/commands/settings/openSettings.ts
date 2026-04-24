import * as vscode from 'vscode';

export function registerSettingsCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.settings', handler);
}
