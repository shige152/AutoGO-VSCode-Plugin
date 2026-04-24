import * as vscode from 'vscode';
import { LogViewProvider } from './logViewProvider';

export function registerLogViewContribution(context: vscode.ExtensionContext): vscode.Disposable[] {
  const logProvider = new LogViewProvider(context);
  const disposable = vscode.window.registerWebviewViewProvider(LogViewProvider.viewType, logProvider, {
    webviewOptions: { retainContextWhenHidden: true },
  });

  return [disposable];
}
