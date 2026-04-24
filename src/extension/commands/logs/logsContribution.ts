import * as vscode from 'vscode';
import { registerLogViewContribution } from '../../views/logViewContribution';
import { registerToggleLogViewLocationCommand } from './toggleLogViewLocation';

type LogViewPreference = 'Panel' | 'View' | 'None';

export interface LogsContributionDeps {
  context: vscode.ExtensionContext;
  setPreference: (preference: LogViewPreference) => void;
}

export function registerLogsContribution(deps: LogsContributionDeps): vscode.Disposable[] {
  const { context, setPreference } = deps;
  const disposables: vscode.Disposable[] = [];

  disposables.push(...registerLogViewContribution(context));
  disposables.push(
    registerToggleLogViewLocationCommand({
      context,
      setPreference,
    }),
  );

  return disposables;
}
