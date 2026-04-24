import * as vscode from 'vscode';

export function registerShowAgHelpCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.showAGHelp', handler);
}
