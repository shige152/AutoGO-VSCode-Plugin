import * as vscode from 'vscode';
import { LogPanelManager } from './logPanelManager';
import { LogViewProvider } from './logViewProvider';

export function ensureLogViewVisible(
  context: vscode.ExtensionContext,
  preference: 'Panel' | 'View' | 'None',
) {
  const isPanelVisible = !!LogPanelManager.currentPanel;
  const isViewVisible = LogViewProvider.isAnyViewVisible();

  if (isPanelVisible || isViewVisible) {
    return;
  }

  if (preference === 'Panel') {
    LogPanelManager.render(context);
  } else if (preference === 'View') {
    vscode.commands.executeCommand('autoGoLogView.focus');
  } else {
    LogPanelManager.render(context);
  }
}
