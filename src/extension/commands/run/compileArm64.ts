import * as vscode from 'vscode';

export function registerCompileArm64Command(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.compileARM64', handler);
}
