import * as vscode from 'vscode';
import { createActivationDependencies } from './activationDependencies';
import { createAgPathResolver } from './agPathResolver';
import { runInitialChecks, runAdbInitialCheck } from './initialChecks';
import { registerContributions } from './registerContributions';

type LogViewPreference = 'Panel' | 'View' | 'None';

let lastLogLocationPreference: LogViewPreference = 'Panel';

export async function activateExtension(context: vscode.ExtensionContext) {
  const {
    configService,
    outputChannel,
    artifactStore,
    adbService,
    iosDebugService,
    settingsAdapter,
    ndkDeps,
  } = createActivationDependencies(context);

  const agPathResolver = createAgPathResolver(artifactStore, () => {
    outputChannel.error('未找到 AutoGo SDK');
    outputChannel.error('请先下载安装 AutoGo SDK，然后重试。');
  });

  outputChannel.success('"autogo-vscode-plugin" 扩展已激活！');

  await runInitialChecks({
    outputChannel,
    configService,
    ndkDeps,
    context,
    artifactStore,
    settingsAdapter,
    logViewPreference: lastLogLocationPreference,
    resolveAg: () => agPathResolver.resolve(),
    onMissingAg: () => {
      vscode.window
        .showInformationMessage(
          '未检测到 AutoGo SDK，是否现在安装？',
          '安装 AutoGo',
          '取消',
        )
        .then((choice) => {
          if (choice === '安装 AutoGo') {
            vscode.commands.executeCommand('AutoGo.updateAutoGo');
          }
        });
    },
  });

  const getLogViewPreference = () => lastLogLocationPreference;
  const getCachedAgPath = () => agPathResolver.getCached();
  const refreshAgPath = () => agPathResolver.resolve();

  const disposables = registerContributions({
    context,
    outputChannel,
    configService,
    artifactStore,
    adbService,
    iosDebugService,
    ndkDeps,
    getAgPath: getCachedAgPath,
    refreshAgPath,
    getLogViewPreference,
    setLogViewPreference: (preference) => {
      lastLogLocationPreference = preference;
    },
  });

  if (disposables.length > 0) {
    context.subscriptions.push(...disposables);
  }

  // 在日志面板初始化完成后执行 ADB 检查，确保日志能正确显示
  void runAdbInitialCheck({
    outputChannel,
    configService,
    artifactStore,
    settingsAdapter,
  });
}

export async function deactivateExtension() {
  // 断开所有 iOS 设备连接
  const { iosConnectionManager } = await import('../../infra/ios/connectionManager');
  await iosConnectionManager.disconnectAll();
}
