import * as vscode from 'vscode';

export function registerCompileDEBCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.compileDEB', handler);
}
