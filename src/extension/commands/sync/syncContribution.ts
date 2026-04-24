import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { ConfigService } from '../../../services/configService';
import { OutputChannel } from '../../../services/outputChannel';
import { executeCommand, handleProcessOutput, LogLevel } from '../../../utils/processUtils';
import { ensureLogViewVisible } from '../../views/logViewVisibility';
import { LogPanelManager } from '../../views/logPanelManager';
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

  disposables.push(
    registerPushCommand(async () => {
      outputChannel.warn('此 "推送" 命令已弃用，请使用右键菜单中的 "推送文件📄" 或 "推送目录📁"。');

      const localPath = await vscode.window.showInputBox({
        prompt: '请输入本地文件或目录的路径',
        placeHolder: '例如: /path/to/local/file_or_folder',
      });

      if (!localPath) {
        outputChannel.warn('未输入本地路径。');
        return;
      }

      const remotePath = await vscode.window.showInputBox({
        prompt: '请输入设备上的目标路径',
        placeHolder: '例如: /sdcard/target/path_or_folder',
        value: '/data/local/tmp',
      });

      if (!remotePath) {
        outputChannel.warn('未输入远程路径。');
        return;
      }

      LogPanelManager.render(context);
      outputChannel.success(`开始推送 ${localPath} 到 ${remotePath}...`);

      const adbPath = await resolveAdbPathForCommand(configService, outputChannel);
      if (!adbPath) {
        return;
      }
      const selectedDevice = configService.selectedDevice;
      const debugMode = configService.debugMode;

      let command = `"${adbPath}"`;
      if (selectedDevice) {
        command += ` -s ${selectedDevice}`;
      }
      command += ` push "${localPath}" "${remotePath}"`;

      if (debugMode) {
        outputChannel.success(`执行命令: ${command}`);
      }

      try {
        const pushProcess = child_process.spawn(command, [], { shell: true });
        handleProcessOutput(pushProcess, outputChannel, '推送(已弃用)', {
          debugMode: debugMode,
          minLogLevel: LogLevel.INFO,
        });
      } catch (error) {
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
        outputChannel.warn('未选择文件。');
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
        outputChannel.warn('未选择目标路径。');
        return;
      }

      if (selectedOption === customPathOption) {
        remotePath = await vscode.window.showInputBox({
          prompt: '请输入设备上的目标文件路径',
          placeHolder: defaultRemotePath,
        });
        if (!remotePath) {
          outputChannel.warn('未输入自定义远程路径。');
          return;
        }
      } else {
        remotePath = selectedOption.substring(selectedOption.indexOf(' ') + 1);
      }

      ensureLogViewVisible(context, getLogViewPreference());
      outputChannel.success(`开始推送文件 ${localPath} 到 ${remotePath}...`);

      const adbPath = await resolveAdbPathForCommand(configService, outputChannel);
      if (!adbPath) {
        return;
      }
      const selectedDevice = configService.selectedDevice;
      const debugMode = configService.debugMode;

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
          outputChannel.error('推送文件命令执行失败。请查看上面的日志获取详细信息。');
        }
      } catch (error) {
        const errorMsg = `执行推送文件命令时发生未预料的异常: ${error instanceof Error ? error.message : String(error)}`;
        outputChannel.error(errorMsg);
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
          outputChannel.warn('未选择文件。');
          return;
        }

        const localPath = fileUris[0].fsPath;
        const fileName = path.basename(localPath);

        if (!fs.existsSync(localPath)) {
          outputChannel.error(`文件不存在: ${localPath}`);
          return;
        }

        ensureLogViewVisible(context, getLogViewPreference());
        outputChannel.success(`开始推送文件 ${fileName} 到 iOS 设备...`);

        try {
          const fileData = fs.readFileSync(localPath);
          const remotePath = `Documents/${fileName}`;

          const result = await client.pushFile(remotePath, fileData);

          if (result.success) {
            outputChannel.success(`文件推送成功: Documents/${fileName}`);
          } else {
            outputChannel.error(`文件推送失败: ${result.error}`);
          }
        } catch (error) {
          const errorMsg = `推送文件时发生异常: ${error instanceof Error ? error.message : String(error)}`;
          outputChannel.error(errorMsg);
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
        outputChannel.warn('未选择目录。');
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
        outputChannel.warn('未选择目标路径。');
        return;
      }

      if (selectedOption === customPathOption) {
        remotePath = await vscode.window.showInputBox({
          prompt: '请输入设备上的目标目录路径',
          placeHolder: defaultRemotePath,
        });
        if (!remotePath) {
          outputChannel.warn('未输入自定义远程路径。');
          return;
        }
      } else {
        remotePath = selectedOption.substring(selectedOption.indexOf(' ') + 1);
      }

      ensureLogViewVisible(context, getLogViewPreference());
      outputChannel.success(`开始推送目录 ${localPath} 到 ${remotePath}...`);

      const adbPath = await resolveAdbPathForCommand(configService, outputChannel);
      if (!adbPath) {
        return;
      }
      const selectedDevice = configService.selectedDevice;
      const debugMode = configService.debugMode;

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
          outputChannel.error('推送目录命令执行失败。请查看上面的日志获取详细信息。');
        }
      } catch (error) {
        const errorMsg = `执行推送目录命令时发生未预料的异常: ${error instanceof Error ? error.message : String(error)}`;
        outputChannel.error(errorMsg);
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
          outputChannel.warn('未选择目录。');
          return;
        }

        const localFolderPath = folderUris[0].fsPath;
        const folderName = path.basename(localFolderPath);

        ensureLogViewVisible(context, getLogViewPreference());
        outputChannel.success(`开始推送目录 ${folderName} 到 iOS 设备...`);

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
              outputChannel.log(`已推送: ${relativePath}`);
            } else {
              failCount++;
              outputChannel.error(`推送失败: ${relativePath} - ${result.error}`);
            }
          }

          if (failCount === 0) {
            outputChannel.success(`目录推送完成，共 ${successCount} 个文件`);
          } else {
            outputChannel.warn(`目录推送完成，成功 ${successCount} 个，失败 ${failCount} 个`);
          }
        } catch (error) {
          const errorMsg = `推送目录时发生异常: ${error instanceof Error ? error.message : String(error)}`;
          outputChannel.error(errorMsg);
        }
      }
    }),
    registerSyncFilesCommand(async () => {
      if (configService.targetPlatform === 'ios') {
        await syncFilesToIos();
        return;
      }

      ensureLogViewVisible(context, getLogViewPreference());
      outputChannel.success('开始同步 resources/libs 和 resources/assets...');
      const debugMode = configService.debugMode;

      const agPath = getAgPath();
      if (!agPath) return;

      const selectedDevice = configService.selectedDevice;

      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          outputChannel.error('未找到工作区，无法确定项目根目录。');
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
          outputChannel.error('部署资源命令执行失败。请查看上面的日志获取详细信息。');
        }
      } catch (error) {
        const errorMsg = `执行同步命令时发生未预料的异常: ${error instanceof Error ? error.message : String(error)}`;
        outputChannel.error(errorMsg);
      }

      async function syncFilesToIos(): Promise<void> {
        const deviceResult = await selectIosDevice(outputChannel, '选择要同步资源的 iOS 设备');
        if (!deviceResult) {
          return;
        }
        const { client } = deviceResult;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          outputChannel.error('未找到工作区，无法确定项目根目录。');
          return;
        }
        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        ensureLogViewVisible(context, getLogViewPreference());
        outputChannel.success('开始同步 resources/assets 和 resources/libs/ios...');

        try {
          let successCount = 0;
          let failCount = 0;

          const assetsDir = path.join(workspaceRoot, 'resources', 'assets');
          if (fs.existsSync(assetsDir)) {
            const assetsFiles = getAllFiles(assetsDir);
            for (const filePath of assetsFiles) {
              const relativePath = path.relative(assetsDir, filePath);
              const remotePath = `assets/${relativePath.replace(/\\/g, '/')}`;

              const fileData = fs.readFileSync(filePath);
              const result = await client.pushFile(remotePath, fileData);

              if (result.success) {
                successCount++;
                outputChannel.log(`[assets] 已推送: ${relativePath}`);
              } else {
                failCount++;
                outputChannel.error(`[assets] 推送失败: ${relativePath} - ${result.error}`);
              }
            }
          } else {
            outputChannel.warn('resources/assets 目录不存在，跳过');
          }

          const libsIosDir = path.join(workspaceRoot, 'resources', 'libs', 'ios');
          if (fs.existsSync(libsIosDir)) {
            const dylibFiles = fs.readdirSync(libsIosDir).filter((f) => f.endsWith('.dylib'));
            for (const dylibFile of dylibFiles) {
              const filePath = path.join(libsIosDir, dylibFile);
              const remotePath = `Frameworks/${dylibFile}`;

              const fileData = fs.readFileSync(filePath);
              const result = await client.pushFile(remotePath, fileData);

              if (result.success) {
                successCount++;
                outputChannel.log(`[libs/ios] 已推送: ${dylibFile}`);
              } else {
                failCount++;
                outputChannel.error(`[libs/ios] 推送失败: ${dylibFile} - ${result.error}`);
              }
            }
          } else {
            outputChannel.warn('resources/libs/ios 目录不存在，跳过');
          }

          if (failCount === 0) {
            outputChannel.success(`资源同步完成，共 ${successCount} 个文件`);
          } else {
            outputChannel.warn(`资源同步完成，成功 ${successCount} 个，失败 ${failCount} 个`);
          }
        } catch (error) {
          const errorMsg = `同步资源时发生异常: ${error instanceof Error ? error.message : String(error)}`;
          outputChannel.error(errorMsg);
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
    const result = await vscode.window.showWarningMessage(
      '没有已连接的 iOS 设备，是否先连接设备？',
      '连接设备',
      '取消'
    );
    if (result === '连接设备') {
      await vscode.commands.executeCommand('AutoGo.connect');
    }
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
    outputChannel.error(`设备 ${selectedHost} 未连接`);
    return null;
  }

  return { host: selectedHost, client };
}
