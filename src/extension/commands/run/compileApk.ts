import * as vscode from 'vscode';

export function registerCompileApkCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.compileAPK', handler);
}
