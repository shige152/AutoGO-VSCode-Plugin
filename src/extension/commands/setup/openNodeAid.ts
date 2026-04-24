import * as vscode from 'vscode';

export function registerNodeAidCommand(handler: () => Promise<void> | void): vscode.Disposable {
  return vscode.commands.registerCommand('AutoGo.nodeaid', handler);
}
