import * as vscode from 'vscode';
import { LogPanelManager } from '../../views/logPanelManager';
import { LogViewProvider } from '../../views/logViewProvider';
import { updateStatusBar } from '../../statusbar/logStatusBar';

type LogViewPreference = 'Panel' | 'View' | 'None';

interface ToggleLogViewDeps {
  context: vscode.ExtensionContext;
  setPreference: (preference: LogViewPreference) => void;
}

export function registerToggleLogViewLocationCommand(
  deps: ToggleLogViewDeps,
): vscode.Disposable {
  const { context, setPreference } = deps;

  return vscode.commands.registerCommand('AutoGo.toggleLogViewLocation', () => {
    const isPanelVisible = !!LogPanelManager.currentPanel;
    const isViewVisible = LogViewProvider.isAnyViewVisible();

    if (isPanelVisible) {
      LogPanelManager.currentPanel?.dispose();
      vscode.commands.executeCommand('autoGoLogView.focus');
      setPreference('View');
      updateStatusBar('View');
      return;
    }

    if (isViewVisible) {
      LogPanelManager.render(context);
      setPreference('Panel');
      updateStatusBar('Panel');
      return;
    }

    LogPanelManager.render(context);
    setPreference('Panel');
  });
}
