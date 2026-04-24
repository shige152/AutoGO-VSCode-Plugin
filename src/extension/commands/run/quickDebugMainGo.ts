import * as vscode from 'vscode';

export function registerQuickDebugMainGoCommand(handler: (...args: unknown[]) => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.quickDebugMainGo', handler);
}
