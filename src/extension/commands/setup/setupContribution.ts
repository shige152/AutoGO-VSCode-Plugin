import * as child_process from 'child_process';
import * as vscode from 'vscode';
import { ArtifactStore } from '../../../app/services/artifactStore';
import { AdbService } from '../../../services/adbService';
import { ConfigService, CONFIG_SECTION } from '../../../services/configService';
import { OutputChannel } from '../../../services/outputChannel';
import { UpdateAutoGoService, VersionInfo } from './updateAutoGoService';
import { executeCommand, handleProcessOutput, LogLevel } from '../../../utils/processUtils';
import { ensureLogViewVisible } from '../../views/logViewVisibility';
import { SettingsPanel } from '../../views/SettingsPanel';
import { checkDeviceConnection } from '../shared/deviceConnection';
import { registerInitCommand } from './initProject';
import { registerNodeAidCommand } from './openNodeAid';
import { registerSetAdbPathCommand } from './setAdbPath';
import { registerShowAgHelpCommand } from './showAgHelp';
import { registerUpdateAutoGoCommand } from './updateAutoGo';
import { registerSettingsCommand } from '../settings/openSettings';

export interface SetupCommandDeps {
  context: vscode.ExtensionContext;
  outputChannel: OutputChannel;
  configService: ConfigService;
  adbService: AdbService;
  artifactStore: ArtifactStore;
  getAgPath: () => string | null;
  refreshAgPath: () => Promise<string | null>;
  getLogViewPreference: () => 'Panel' | 'View' | 'None';
}

async function showVersionPicker(
  versions: VersionInfo[],
  localVersion: string | null,
): Promise<string | undefined> {
  type VersionPickItem = vscode.QuickPickItem & { rawVersion: string };

  const items: VersionPickItem[] = versions.map((version) => {
    const isCurrent = localVersion && version.version === localVersion;
    const label = `$(tag) ${version.version}`;

    let description = '';
    if (version.date) {
      description += `$(calendar) ${version.date}`;
    }
    if (version.cached) {
      description += '  $(database) 已下载';
    }
    if (isCurrent) {
      description += '  $(check) 当前版本';
    }

    const changesText = version.changes.join('; ');

    return {
      label,
      description,
      detail: changesText.length > 100 ? `${changesText.slice(0, 100)}...` : changesText,
      rawVersion: version.version,
    };
  });

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `选择要安装的版本 (当前: ${localVersion || '未知'})`,
    title: '更新 AutoGo SDK',
  });

  return selected?.rawVersion;
}

export function registerSetupCommands(deps: SetupCommandDeps): vscode.Disposable[] {
  const {
    context,
    outputChannel,
    configService,
    adbService,
    artifactStore,
    getAgPath,
    refreshAgPath,
    getLogViewPreference,
  } = deps;

  const updateAutoGo = new UpdateAutoGoService(outputChannel, configService);

  const disposables: vscode.Disposable[] = [];

  disposables.push(
    registerInitCommand(async () => {
      ensureLogViewVisible(context, getLogViewPreference());
      outputChannel.success('开始初始化项目');
      const agPath = getAgPath();
      if (!agPath) {
        return;
      }
      const debugMode = configService.debugMode;

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        outputChannel.error('未找到工作区，无法确定项目根目录。');
        return;
      }
      const cwd = workspaceFolders[0].uri.fsPath;

      const platform = await vscode.window.showQuickPick(
        [
          { label: 'Android', description: 'Android 平台', value: 'android' },
          { label: 'iOS', description: 'iOS 平台', value: 'ios' },
        ],
        {
          placeHolder: '选择目标平台',
          title: '目标平台选择',
        }
      );

      if (!platform) {
        outputChannel.error('用户取消了初始化');
        return;
      }

      await vscode.workspace.getConfiguration(CONFIG_SECTION).update('targetPlatform', platform.value, vscode.ConfigurationTarget.Workspace);

      try {
        const result = await executeCommand(
          agPath,
          ['init', '-t', platform.value],
          outputChannel,
          {
            cwd: cwd,
            debugMode: debugMode,
            commandDisplayName: '初始化',
            configService: configService,
          }
        );

        outputChannel.success(`初始化完成（${platform.label} 平台）`);

        if (!result.success) {
          outputChannel.error('初始化命令执行失败。请查看上面的日志获取详细信息。');
        }
      } catch (error) {
        const errorMsg = `执行初始化命令时发生未预料的异常: ${error instanceof Error ? error.message : String(error)}`;
        outputChannel.error(errorMsg);
      }
    }),
    registerShowAgHelpCommand(async () => {
      ensureLogViewVisible(context, getLogViewPreference());
      outputChannel.success('获取 AutoGo 帮助信息...');
      const agPath = getAgPath();
      if (!agPath) {
        return;
      }
      const debugMode = configService.debugMode;

      const command = `"${agPath}" help`;
      if (debugMode) {
        outputChannel.success(`执行命令: ${command}`);
      }

      try {
        const helpProcess = child_process.spawn(command, [], { shell: true });
        handleProcessOutput(helpProcess, outputChannel, '帮助信息', {
          debugMode: debugMode,
          minLogLevel: LogLevel.INFO,
        });
      } catch (error) {
        const errorMsg = `执行帮助命令时发生异常: ${error instanceof Error ? error.message : String(error)}`;
        outputChannel.error(errorMsg);
      }
    }),
    registerSettingsCommand(() => {
      SettingsPanel.render(context, outputChannel, configService, artifactStore, artifactStore.getManagedAgPath());
    }),
    registerUpdateAutoGoCommand(async () => {
      ensureLogViewVisible(context, getLogViewPreference());

      try {
        outputChannel.success('正在检查更新...');

        const agExecutablePath = artifactStore.getManagedAgPath();
        const localVersion = await updateAutoGo.getLocalVersion(agExecutablePath);
        if (localVersion) {
          outputChannel.log(`本地版本: ${localVersion}`);
        } else {
          outputChannel.log('本地版本: 未安装或未知');
        }

        const versions = await updateAutoGo.fetchVersions();
        if (versions.length === 0) {
          outputChannel.error('解析版本信息失败');
          vscode.window.showErrorMessage('解析版本信息失败');
          return;
        }

        outputChannel.log(`最新版本: ${versions[0].version}`);
        outputChannel.log('--- 近期更新日志 ---');
        versions.slice(0, 5).forEach((version) => {
          outputChannel.log(`[${version.version}] ${version.date}`);
          version.changes.forEach((change) => outputChannel.log(`  ${change}`));
          outputChannel.log('');
        });

        const selectedVersion = await showVersionPicker(versions, localVersion);
        if (!selectedVersion) {
          outputChannel.success('用户取消了更新');
          return;
        }

        const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        await updateAutoGo.downloadAndInstall(selectedVersion, agExecutablePath, workspaceDir);
        await refreshAgPath();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (configService.debugMode) {
          outputChannel.error(`处理更新请求时出错: ${errorMessage}`);
        } else {
          outputChannel.error('更新请求处理失败');
        }
        vscode.window.showErrorMessage(`更新失败: ${errorMessage}`);
      }
    }),
    registerNodeAidCommand(async () => {
      ensureLogViewVisible(context, getLogViewPreference());
      outputChannel.success('启动节点助手服务...');
      const debugMode = configService.debugMode;

      const agPath = getAgPath();
      if (!agPath) {
        return;
      }

      const selectedDevice = configService.selectedDevice;

      if (!selectedDevice) {
        const message = '未选择设备，请先连接设备。';
        outputChannel.error(message);
        const connectOption = '连接设备';
        const result = await vscode.window.showErrorMessage(message, connectOption);
        if (result === connectOption) {
          vscode.commands.executeCommand('AutoGo.connect');
        }
        return;
      }

      const connectionStatus = await checkDeviceConnection(adbService, outputChannel, selectedDevice, configService);
      if (connectionStatus !== 'connected') {
        const message =
          connectionStatus === 'not_connected'
            ? `设备 ${selectedDevice} 未连接，请先连接设备。`
            : `检查设备 ${selectedDevice} 连接状态失败。`;
        outputChannel.error(message);
        const connectOption = '连接设备';
        const result = await vscode.window.showErrorMessage(message, connectOption);
        if (result === connectOption) {
          vscode.commands.executeCommand('AutoGo.connect');
        }
        return;
      }

      const nodeaidUrl = `http://127.0.0.1:8801/index.html?device=${selectedDevice}`;

      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let cwd: string | undefined;
        if (workspaceFolders && workspaceFolders.length > 0) {
          cwd = workspaceFolders[0].uri.fsPath;
        } else if (debugMode) {
          outputChannel.warn('未找到工作区，可能无法正确启动节点助手。');
        }

        await executeCommand(
          agPath,
          ['nodeserve'],
          outputChannel,
          {
            cwd: cwd,
            debugMode: debugMode,
            commandDisplayName: '启动节点助手服务',
            configService: configService,
          }
        );

        outputChannel.success(`节点信息：${nodeaidUrl}`);
        vscode.env.openExternal(vscode.Uri.parse(nodeaidUrl));
      } catch (error) {
        const errorMsg = `执行节点助手命令时发生未预料的异常: ${error instanceof Error ? error.message : String(error)}`;
        outputChannel.error(errorMsg);
      }
    }),
    registerSetAdbPathCommand(async () => {
      const adbPath = await vscode.window.showInputBox({
        prompt: '请输入 ADB 可执行文件的完整路径',
        placeHolder: '例如: C:\\platform-tools\\adb.exe',
      });

      if (!adbPath) {
        outputChannel.warn('未输入 ADB 路径。');
        return;
      }

      try {
        await vscode.workspace.getConfiguration(CONFIG_SECTION).update('adbPath', adbPath, vscode.ConfigurationTarget.Global);
        outputChannel.success(`ADB 路径已设置为: ${adbPath}`);
        SettingsPanel.postMessageToWebview({ command: 'adbPathUpdated', path: adbPath });
      } catch (error: any) {
        outputChannel.error(`保存 ADB 路径失败: ${error.message}`);
      }
    }),
  );

  return disposables;
}
