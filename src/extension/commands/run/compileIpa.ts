import * as vscode from 'vscode';

export function registerCompileIPACommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.compileIPA', handler);
}