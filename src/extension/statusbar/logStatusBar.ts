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
    statusBarItem.text = '$(editor-layout) AutoGo 日志: 编辑器';
    statusBarItem.tooltip = '点击切换 AutoGo 日志到视图区域';
    statusBarItem.show();
    return;
  }

  if (location === 'View') {
    statusBarItem.text = '$(layout-sidebar-right) AutoGo 日志: 视图';
    statusBarItem.tooltip = '点击切换 AutoGo 日志到编辑器区域';
    statusBarItem.show();
    return;
  }

  statusBarItem.text = '$(output) AutoGo 日志';
  statusBarItem.tooltip = '点击打开 AutoGo 日志 (默认编辑器)';
  statusBarItem.show();
}
