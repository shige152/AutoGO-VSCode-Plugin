import * as vscode from 'vscode';

export function registerCompileAmd64Command(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.compileAMD64', handler);
}
