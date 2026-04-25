import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { ConfigService } from '../../../services/configService';
import { OutputChannel } from '../../../services/outputChannel';
import { executeCommand } from '../../../utils/processUtils';
import {
  USER_MESSAGES,
  formatDeviceNotConnected,
  formatFileNotFound,
} from '../../../utils/userMessages';
import { ensureLogViewVisible } from '../../views/logViewVisibility';
import { resolveAdbPathForCommand } from '../../adbPathResolver';
import { registerPushCommand } from './pushProject';
import { registerPushFileCommand } from './pushFile';
import { registerPushFolderCommand } from './pushFolder';
import { registerSyncFilesCommand } from './syncFiles';
import { iosConnectionManager } from '../../../infra/ios/connectionManager';

export interface SyncCommandDeps {
  context: vscode.ExtensionContext;
  outputChannel: OutputChannel;
  configService: ConfigService;
  getAgPath: () => string | null;
  getLogViewPreference: () => 'Panel' | 'View' | 'None';
}

export function registerSyncCommands(deps: SyncCommandDeps): vscode.Disposable[] {
  const { context, outputChannel, configService, getAgPath, getLogViewPreference } = deps;
  const disposables: vscode.Disposable[] = [];
  const logActionState = (
    action: string,
    state: 'start' | 'success' | 'failure'
  ): void => {
    if (state === 'start') {
      outputChannel.success(`开始${action}`);
      return;
    }

    if (state === 'success') {
      outputChannel.success(`${action}结束`);
      return;
    }

    outputChannel.error(`${action}失败`);
  };
  const logBatchResult = (
    action: string,
    successCount: number,
    failCount: number
  ): void => {
    if (failCount === 0) {
      outputChannel.success(`${action}结束，共 ${successCount} 个文件`);
      return;
    }

    outputChannel.warn(`${action}结束，成功 ${successCount} 个，失败 ${failCount} 个`);
  };

  disposables.push(
    registerPushCommand(async () => {
      outputChannel.warn('此 "推送" 命令已弃用，请使用右键菜单中的 "推送文件📄" 或 "推送目录📁"。');

      const localPath = await vscode.window.showInputBox({
        prompt: '请输入本地文件或目录的路径',
        placeHolder: '例如: /path/to/local/file_or_folder',
      });

      if (!localPath) {
        return;
      }

      const remotePath = await vscode.window.showInputBox({
        prompt: '请输入设备上的目标路径',
        placeHolder: '例如: /sdcard/target/path_or_folder',
        value: '/data/local/tmp',
      });

      if (!remotePath) {
        return;
      }

      ensureLogViewVisible(context, getLogViewPreference());

      const adbPath = await resolveAdbPathForCommand(configService, outputChannel);
      if (!adbPath) {
        return;
      }
      const selectedDevice = configService.selectedDevice;
      const debugMode = configService.debugMode;
      logActionState('推送', 'start');

      try {
        const args = [];
        if (selectedDevice) {
          args.push('-s', selectedDevice);
        }
        args.push('push', localPath, remotePath);

        const result = await executeCommand(
          adbPath,
          args,
          outputChannel,
          {
            debugMode: debugMode,
            commandDisplayName: '推送',
            shell: false,
          }
        );

        if (!result.success) {
          logActionState('推送', 'failure');
          return;
        }

        logActionState('推送', 'success');
      } catch (error) {
        logActionState('推送', 'failure');
        const errorMsg = `执行推送命令时发生异常: ${error instanceof Error ? error.message : String(error)}`;
        outputChannel.error(errorMsg);
      }
    }),
    registerPushFileCommand(async () => {
      if (configService.targetPlatform === 'ios') {
        await pushFileToIos();
        return;
      }

      const fileUris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: '选择要推送的文件',
      });

      if (!fileUris || fileUris.length === 0) {
        return;
      }

      const localPath = fileUris[0].fsPath;
      const fileName = path.basename(localPath);
      const defaultRemotePath = `/data/local/tmp/${fileName}`;
      const downloadRemotePath = `/sdcard/Download/${fileName}`;
      const customPathOption = '输入自定义路径...';

      const quickPickItems = [
        `[默认] ${defaultRemotePath}`,
        `[下载] ${downloadRemotePath}`,
        customPathOption,
      ];

      const selectedOption = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: '选择或输入设备上的目标文件路径',
      });

      let remotePath: string | undefined;

      if (!selectedOption) {
        return;
      }

      if (selectedOption === customPathOption) {
        remotePath = await vscode.window.showInputBox({
          prompt: '请输入设备上的目标文件路径',
          placeHolder: defaultRemotePath,
        });
        if (!remotePath) {
          return;
        }
      } else {
        remotePath = selectedOption.substring(selectedOption.indexOf(' ') + 1);
      }

      ensureLogViewVisible(context, getLogViewPreference());

      const adbPath = await resolveAdbPathForCommand(configService, outputChannel);
      if (!adbPath) {
        return;
      }
      const selectedDevice = configService.selectedDevice;
      const debugMode = configService.debugMode;
      logActionState('推送文件', 'start');

      try {
        const args = [];
        if (selectedDevice) {
          args.push('-s', selectedDevice);
        }
        args.push('push', localPath, remotePath);

        const result = await executeCommand(
          adbPath,
          args,
          outputChannel,
          {
            debugMode: debugMode,
            commandDisplayName: '推送文件',
            shell: false,
          }
        );

        if (!result.success) {
          logActionState('推送文件', 'failure');
          return;
        }

        logActionState('推送文件', 'success');
      } catch (error) {
        logActionState('推送文件', 'failure');
        if (debugMode) {
          const errorMsg = `执行推送文件命令时发生未预料的异常: ${error instanceof Error ? error.message : String(error)}`;
          outputChannel.error(errorMsg);
        }
      }

      async function pushFileToIos(): Promise<void> {
        const deviceResult = await selectIosDevice(outputChannel, '选择要推送文件的 iOS 设备');
        if (!deviceResult) {
          return;
        }
        const { client } = deviceResult;

        const fileUris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          openLabel: '选择要推送的文件',
        });

        if (!fileUris || fileUris.length === 0) {
          return;
        }

        const localPath = fileUris[0].fsPath;
        const fileName = path.basename(localPath);

        if (!fs.existsSync(localPath)) {
          outputChannel.error(formatFileNotFound(localPath));
          return;
        }

        ensureLogViewVisible(context, getLogViewPreference());
        logActionState('推送文件', 'start');

        try {
          const fileData = fs.readFileSync(localPath);
          const remotePath = `Documents/${fileName}`;

          const result = await client.pushFile(remotePath, fileData);

          if (result.success) {
            logActionState('推送文件', 'success');
          } else {
            outputChannel.error(`推送文件失败: ${result.error}`);
          }
        } catch (error) {
          outputChannel.error(`推送文件失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }),
    registerPushFolderCommand(async () => {
      if (configService.targetPlatform === 'ios') {
        await pushFolderToIos();
        return;
      }

      const folderUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: '选择要推送的目录',
      });

      if (!folderUris || folderUris.length === 0) {
        return;
      }

      const localPath = folderUris[0].fsPath;
      const folderName = path.basename(localPath);
      const defaultRemotePath = `/data/local/tmp/${folderName}`;
      const downloadRemotePath = `/sdcard/Download/${folderName}`;
      const customPathOption = '输入自定义路径...';

      const quickPickItems = [
        `[默认] ${defaultRemotePath}`,
        `[下载] ${downloadRemotePath}`,
        customPathOption,
      ];

      const selectedOption = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: '选择或输入设备上的目标目录路径',
      });

      let remotePath: string | undefined;

      if (!selectedOption) {
        return;
      }

      if (selectedOption === customPathOption) {
        remotePath = await vscode.window.showInputBox({
          prompt: '请输入设备上的目标目录路径',
          placeHolder: defaultRemotePath,
        });
        if (!remotePath) {
          return;
        }
      } else {
        remotePath = selectedOption.substring(selectedOption.indexOf(' ') + 1);
      }

      ensureLogViewVisible(context, getLogViewPreference());

      const adbPath = await resolveAdbPathForCommand(configService, outputChannel);
      if (!adbPath) {
        return;
      }
      const selectedDevice = configService.selectedDevice;
      const debugMode = configService.debugMode;
      logActionState('推送目录', 'start');

      try {
        const args = [];
        if (selectedDevice) {
          args.push('-s', selectedDevice);
        }
        args.push('push', localPath, remotePath);

        const result = await executeCommand(
          adbPath,
          args,
          outputChannel,
          {
            debugMode: debugMode,
            commandDisplayName: '推送目录',
            shell: false,
          }
        );

        if (!result.success) {
          logActionState('推送目录', 'failure');
          return;
        }

        logActionState('推送目录', 'success');
      } catch (error) {
        logActionState('推送目录', 'failure');
        if (debugMode) {
          const errorMsg = `执行推送目录命令时发生未预料的异常: ${error instanceof Error ? error.message : String(error)}`;
          outputChannel.error(errorMsg);
        }
      }

      async function pushFolderToIos(): Promise<void> {
        const deviceResult = await selectIosDevice(outputChannel, '选择要推送目录的 iOS 设备');
        if (!deviceResult) {
          return;
        }
        const { client } = deviceResult;

        const folderUris = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: '选择要推送的目录',
        });

        if (!folderUris || folderUris.length === 0) {
          return;
        }

        const localFolderPath = folderUris[0].fsPath;
        const folderName = path.basename(localFolderPath);

        ensureLogViewVisible(context, getLogViewPreference());
        logActionState('推送目录', 'start');

        try {
          const files = getAllFiles(localFolderPath);
          let successCount = 0;
          let failCount = 0;

          for (const filePath of files) {
            const relativePath = path.relative(localFolderPath, filePath);
            const remotePath = `Documents/${folderName}/${relativePath.replace(/\\/g, '/')}`;

            const fileData = fs.readFileSync(filePath);
            const result = await client.pushFile(remotePath, fileData);

            if (result.success) {
              successCount++;
            } else {
              failCount++;
              outputChannel.error(`推送失败: ${relativePath} - ${result.error}`);
            }
          }

          logBatchResult('推送目录', successCount, failCount);
        } catch (error) {
          logActionState('推送目录', 'failure');
          outputChannel.error(`推送目录失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }),
    registerSyncFilesCommand(async () => {
      if (configService.targetPlatform === 'ios') {
        await syncFilesToIos();
        return;
      }

      ensureLogViewVisible(context, getLogViewPreference());
      const debugMode = configService.debugMode;

      const agPath = getAgPath();
      if (!agPath) return;
      logActionState('同步资源', 'start');

      const selectedDevice = configService.selectedDevice;

      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          outputChannel.error(USER_MESSAGES.workspaceNotFound);
          return;
        }
        const cwd = workspaceFolders[0].uri.fsPath;

        const args = ['deploy'];
        if (selectedDevice) {
          args.push('-s', selectedDevice);
        }

        const result = await executeCommand(
          agPath,
          args,
          outputChannel,
          {
            cwd: cwd,
            debugMode: debugMode,
            commandDisplayName: '部署资源',
            configService: configService,
          }
        );

        if (!result.success) {
          logActionState('同步资源', 'failure');
          return;
        }

        logActionState('同步资源', 'success');
      } catch (error) {
        logActionState('同步资源', 'failure');
        if (debugMode) {
          const errorMsg = `执行同步命令时发生未预料的异常: ${error instanceof Error ? error.message : String(error)}`;
          outputChannel.error(errorMsg);
        }
      }

      async function syncFilesToIos(): Promise<void> {
        const deviceResult = await selectIosDevice(outputChannel, '选择要同步资源的 iOS 设备');
        if (!deviceResult) {
          return;
        }
        const { client } = deviceResult;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          outputChannel.error(USER_MESSAGES.workspaceNotFound);
          return;
        }
        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        ensureLogViewVisible(context, getLogViewPreference());
        logActionState('同步资源', 'start');

        try {
          let successCount = 0;
          let failCount = 0;

          const assetsDir = path.join(workspaceRoot, 'resources', 'assets');
          const hasAssetsDir = fs.existsSync(assetsDir);
          const libsIosDir = path.join(workspaceRoot, 'resources', 'libs', 'ios');
          const hasLibsIosDir = fs.existsSync(libsIosDir);

          if (!hasAssetsDir && !hasLibsIosDir) {
            outputChannel.warn('未找到可同步的资源目录：resources/assets、resources/libs/ios');
            logActionState('同步资源', 'failure');
            return;
          }

          if (hasAssetsDir) {
            const assetsFiles = getAllFiles(assetsDir);
            for (const filePath of assetsFiles) {
              const relativePath = path.relative(assetsDir, filePath);
              const remotePath = `assets/${relativePath.replace(/\\/g, '/')}`;

              const fileData = fs.readFileSync(filePath);
              const result = await client.pushFile(remotePath, fileData);

              if (result.success) {
                successCount++;
              } else {
                failCount++;
                outputChannel.error(`[assets] 推送失败: ${relativePath} - ${result.error}`);
              }
            }
          }

          if (hasLibsIosDir) {
            const dylibFiles = fs.readdirSync(libsIosDir).filter((f) => f.endsWith('.dylib'));
            for (const dylibFile of dylibFiles) {
              const filePath = path.join(libsIosDir, dylibFile);
              const remotePath = `Frameworks/${dylibFile}`;

              const fileData = fs.readFileSync(filePath);
              const result = await client.pushFile(remotePath, fileData);

              if (result.success) {
                successCount++;
              } else {
                failCount++;
                outputChannel.error(`[libs/ios] 推送失败: ${dylibFile} - ${result.error}`);
              }
            }
          }

          logBatchResult('同步资源', successCount, failCount);
        } catch (error) {
          logActionState('同步资源', 'failure');
          outputChannel.error(`同步资源失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    })
  );

  return disposables;
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  try {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          getAllFiles(fullPath, arrayOfFiles);
        } else {
          arrayOfFiles.push(fullPath);
        }
      } catch {
        // 跳过无法访问的文件/目录
      }
    }
  } catch {
    // 目录无法读取，返回已收集的文件
  }

  return arrayOfFiles;
}

async function selectIosDevice(
  outputChannel: OutputChannel,
  placeHolder: string
): Promise<{ host: string; client: NonNullable<ReturnType<typeof iosConnectionManager.getClient>> } | null> {
  const devices = iosConnectionManager.getAllDevices();
  if (devices.length === 0) {
    outputChannel.warn(USER_MESSAGES.noIosDeviceConnected);
    return null;
  }

  let selectedHost: string;
  if (devices.length === 1) {
    selectedHost = devices[0].id;
  } else {
    const selected = await vscode.window.showQuickPick(
      devices.map((d) => ({
        label: d.id,
        description: `连接于 ${d.connectedAt.toLocaleString()}`,
        host: d.id,
      })),
      { placeHolder }
    );
    if (!selected) {
      return null;
    }
    selectedHost = selected.host;
  }

  const client = iosConnectionManager.getClient(selectedHost);
  if (!client) {
    outputChannel.error(formatDeviceNotConnected(selectedHost));
    return null;
  }

  return { host: selectedHost, client };
}
