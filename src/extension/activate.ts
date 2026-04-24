import * as vscode from 'vscode';
import { CompositionRoot, createCompositionRoot } from './compositionRoot';

let compositionRoot: CompositionRoot | undefined;

export async function activate(context: vscode.ExtensionContext) {
  compositionRoot = createCompositionRoot(context);
  return compositionRoot.activate();
}

export function getCompositionRoot() {
  return compositionRoot;
}
