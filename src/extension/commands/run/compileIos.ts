import * as vscode from 'vscode';

export function registerCompileIOSCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.compileIOS', handler);
}