import { getCompositionRoot } from './activate';

export function deactivate() {
  return getCompositionRoot()?.deactivate();
}
