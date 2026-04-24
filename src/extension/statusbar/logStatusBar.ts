import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem | undefined;

export function initializeLogStatusBar(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'AutoGo.toggleLogViewLocation';
  context.subscriptions.push(statusBarItem);
  updateStatusBar('None');
}

export function updateStatusBar(location: 'Panel' | 'View' | 'None') {
  if (!statusBarItem) {
    return;
  }

  if (location === 'Panel') {
    statusBarItem.text = '$(editor-layout) AutoGo \\u65e5\\u5fd7: \\u7f16\\u8f91\\u5668';
    statusBarItem.tooltip = '\\u70b9\\u51fb\\u5207\\u6362 AutoGo \\u65e5\\u5fd7\\u5230\\u89c6\\u56fe\\u533a\\u57df';
    statusBarItem.show();
    return;
  }

  if (location === 'View') {
    statusBarItem.text = '$(layout-sidebar-right) AutoGo \\u65e5\\u5fd7: \\u89c6\\u56fe';
    statusBarItem.tooltip = '\\u70b9\\u51fb\\u5207\\u6362 AutoGo \\u65e5\\u5fd7\\u5230\\u7f16\\u8f91\\u5668\\u533a\\u57df';
    statusBarItem.show();
    return;
  }

  statusBarItem.text = '$(output) AutoGo \\u65e5\\u5fd7';
  statusBarItem.tooltip = '\\u70b9\\u51fb\\u6253\\u5f00 AutoGo \\u65e5\\u5fd7 (\\u9ed8\\u8ba4\\u7f16\\u8f91\\u5668)';
  statusBarItem.show();
}
