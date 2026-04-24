import * as vscode from 'vscode';
import { ArtifactStore } from '../../app/services/artifactStore';
import { ConfigService } from '../../services/configService';
import { AdbService } from '../../services/adbService';
import { IosDebugService } from '../../services/iosDebugService';
import { OutputChannel, getOutputChannel, initializeOutputChannel } from '../../services/outputChannel';
import { NdkDownloadDeps } from '../../services/environmentSetupService';
import { VscodeLogger } from '../adapters/vscodeLogger';
import { VscodeSettings } from '../adapters/vscodeSettings';
import { NodeFileSystem } from '../../infra/fs/nodeFileSystem';
import { NodeDownloader } from '../../infra/download/nodeDownloader';
import { NodeZipExtractor } from '../../infra/zip/nodeZipExtractor';
import { NodeVerifier } from '../../infra/verify/nodeVerifier';
import { NodeFileLock } from '../../infra/lock/fileLock';
import { getSupportedPlatform } from './platform';
import { resolveAdbPathForCommand } from '../adbPathResolver';

export interface ActivationDependencies {
  configService: ConfigService;
  outputChannel: OutputChannel;
  artifactStore: ArtifactStore;
  adbService: AdbService;
  iosDebugService: IosDebugService;
  settingsAdapter: VscodeSettings;
  ndkDeps: NdkDownloadDeps;
}

export function createActivationDependencies(
  context: vscode.ExtensionContext,
): ActivationDependencies {
  initializeOutputChannel(context);

  const configService = new ConfigService();
  const outputChannel = getOutputChannel();
  const logger = new VscodeLogger(outputChannel);
  const settingsAdapter = new VscodeSettings(configService);
  const fileSystem = new NodeFileSystem();
  const downloader = new NodeDownloader(fileSystem, logger);
  const zipExtractor = new NodeZipExtractor(logger);
  const verifier = new NodeVerifier();
  const fileLock = new NodeFileLock(logger);
  const platform = getSupportedPlatform();
  const artifactStore = new ArtifactStore(
    platform,
    fileSystem,
    logger,
    downloader,
    zipExtractor,
    verifier,
    fileLock,
  );
  const ndkDeps: NdkDownloadDeps = {
    downloader,
    zipExtractor,
    fileSystem,
  };

  const adbService = new AdbService(
    context,
    outputChannel,
    () => resolveAdbPathForCommand(configService, outputChannel),
  );

  const iosDebugService = new IosDebugService(outputChannel);

  return {
    configService,
    outputChannel,
    artifactStore,
    adbService,
    iosDebugService,
    settingsAdapter,
    ndkDeps,
  };
}
