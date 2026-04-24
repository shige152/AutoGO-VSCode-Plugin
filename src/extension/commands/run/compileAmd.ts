import * as vscode from 'vscode';

export function registerCompileAmdCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.compileAMD', handler);
}
