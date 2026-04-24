import * as vscode from 'vscode';
import { activateExtension, deactivateExtension } from './activation/activateExtension';

export interface CompositionRoot {
  activate(): Promise<void> | void;
  deactivate(): Promise<void> | void;
}

export function createCompositionRoot(context: vscode.ExtensionContext): CompositionRoot {
  return {
    activate: () => activateExtension(context),
    deactivate: () => deactivateExtension(),
  };
}
