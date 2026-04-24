import * as vscode from 'vscode';
import { ArtifactStore } from '../../app/services/artifactStore';
import { ResolveAdb } from '../../app/usecases/tools/resolveAdb';
import { ConfigService } from '../../services/configService';
import { OutputChannel } from '../../services/outputChannel';
import {
  checkAndInstallGoExtension,
  checkAndSetupAndroidNDK,
  checkAutoGOVersion,
  NdkDownloadDeps,
} from '../../services/environmentSetupService';
import { VscodeSettings } from '../adapters/vscodeSettings';

type LogViewPreference = 'Panel' | 'View' | 'None';

export interface InitialChecksDeps {
  outputChannel: OutputChannel;
  configService: ConfigService;
  ndkDeps: NdkDownloadDeps;
  context: vscode.ExtensionContext;
  artifactStore: ArtifactStore;
  settingsAdapter: VscodeSettings;
  logViewPreference: LogViewPreference;
  resolveAg: () => Promise<string | null>;
  onMissingAg: () => void;
}

export interface AdbInitialCheckDeps {
  outputChannel: OutputChannel;
  configService: ConfigService;
  artifactStore: ArtifactStore;
  settingsAdapter: VscodeSettings;
}

export async function runInitialChecks(deps: InitialChecksDeps): Promise<string | null> {
  const {
    outputChannel,
    configService,
    ndkDeps,
    context,
    artifactStore,
    settingsAdapter,
    logViewPreference,
    resolveAg,
    onMissingAg,
  } = deps;

  if (process.env.AUTOGO_SKIP_INITIAL_CHECKS === '1') {
    outputChannel.info('已跳过初始化检查（AUTOGO_SKIP_INITIAL_CHECKS=1）。');
    return null;
  }

  const initialAgPath = await resolveAg();
  if (!initialAgPath) {
    onMissingAg();
  }

  checkAutoGOVersion(initialAgPath, outputChannel, configService);

  checkAndInstallGoExtension(outputChannel, configService);
  checkAndSetupAndroidNDK(outputChannel, ndkDeps, context, logViewPreference, configService);

  return initialAgPath;
}

/**
 * 独立的 ADB 初始检查函数，应在日志面板初始化完成后调用
 * 只做检查并输出日志，不弹出下载对话框（用户可在设置面板中使用"自动下载"按钮配置ADB）
 */
export async function runAdbInitialCheck(deps: AdbInitialCheckDeps): Promise<void> {
  const { outputChannel, configService, artifactStore, settingsAdapter } = deps;

  try {
    const configuredAdbPath = configService.get<string>('adbPath', '').trim();
    const resolvedAdbPath = settingsAdapter.adbPath.trim();
    const configuredValid = configuredAdbPath
      ? await artifactStore.isValidPath(configuredAdbPath)
      : false;
    const resolvedValid = resolvedAdbPath
      ? resolvedAdbPath === configuredAdbPath
        ? configuredValid
        : await artifactStore.isValidPath(resolvedAdbPath)
      : false;
    const managedReady = await artifactStore.isManagedAdbReady();

    // 如果有有效的 ADB 路径，输出成功信息
    if (resolvedValid || managedReady) {
      const resolvedAdb = await new ResolveAdb(artifactStore, settingsAdapter).execute();
      if (resolvedAdb.managed && settingsAdapter.adbPath.trim() !== resolvedAdb.path) {
        await configService.updateAdbPath(resolvedAdb.path);
      }
      const source = resolvedAdb.managed
        ? '托管安装'
        : configuredValid
          ? '配置'
          : resolvedAdbPath && resolvedAdbPath !== configuredAdbPath
            ? '环境变量'
            : '配置';
      outputChannel.success(`ADB（${source}）：${resolvedAdb.path}`);
    } else {
      // 没有有效的 ADB 路径，只输出警告日志
      if (configuredAdbPath && !configuredValid) {
        outputChannel.warn(`配置的 ADB 路径无效: ${configuredAdbPath}`);
      }
      outputChannel.warn('未检测到有效的 ADB，请在设置中"手动配置"或"自动下载"。');
    }
  } catch (error) {
    outputChannel.error(`ADB 检查失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}
