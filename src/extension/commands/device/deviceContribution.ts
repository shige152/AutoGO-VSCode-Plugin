import * as child_process from 'child_process';
import * as vscode from 'vscode';
import { AdbService } from '../../../services/adbService';
import { IosDebugService } from '../../../services/iosDebugService';
import { ConfigService, CONFIG_SECTION } from '../../../services/configService';
import { OutputChannel } from '../../../services/outputChannel';
import { ensureLogViewVisible } from '../../views/logViewVisibility';
import { registerConnectCommand } from './connectDevice';
import { resolveAdbPathForCommand } from '../../adbPathResolver';
import { DEFAULT_IOS_DEBUG_PORT } from '../../../infra/ios/protocol/messageTypes';

export interface DeviceCommandDeps {
  context: vscode.ExtensionContext;
  outputChannel: OutputChannel;
  configService: ConfigService;
  adbService: AdbService;
  iosDebugService: IosDebugService;
  getLogViewPreference: () => 'Panel' | 'View' | 'None';
}

export function registerDeviceCommands(deps: DeviceCommandDeps): vscode.Disposable[] {
  const { context, outputChannel, configService, adbService, iosDebugService, getLogViewPreference } = deps;
  const disposables: vscode.Disposable[] = [];

  disposables.push(
    registerConnectCommand(async () => {
      ensureLogViewVisible(context, getLogViewPreference());

      // iOS 平台使用 TCP 协议连接
      if (configService.targetPlatform === 'ios') {
        await connectIosDevice();
        return;
      }

      // Android 平台使用 ADB 连接
      const adbPath = await resolveAdbPathForCommand(configService, outputChannel);
      if (!adbPath) {
        return;
      }
      outputChannel.success('正在查找设备...');
      const devices = await adbService.getDevices(adbPath);

      const quickPickItems: string[] = ['远程调试'];
      if (devices.length > 0) {
        outputChannel.success(`找到 ${devices.length} 个设备: ${devices.join(', ')}`);
        devices.forEach((device: string) => {
          quickPickItems.push(device);
        });
      }

      const selectedOption = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: '选择连接方式或设备',
      });

      if (!selectedOption) {
        outputChannel.success('用户取消了连接');
        return;
      }

      if (selectedOption === '远程调试') {
         await connectWireless(outputChannel, configService, adbPath);
      } else {
        const selectedDevice = selectedOption;

        try {
          await vscode.workspace
            .getConfiguration(CONFIG_SECTION)
            .update('selectedDevice', selectedDevice, vscode.ConfigurationTarget.Global);
          outputChannel.success(`已选择设备: ${selectedDevice}`);
          if (configService.debugMode) {
            outputChannel.log(`配置已更新: selectedDevice = ${selectedDevice}`);
          }
        } catch (updateError) {
          outputChannel.error(
            `更新设备配置失败: ${updateError instanceof Error ? updateError.message : String(updateError)}`
          );
        }
      }

      async function connectIosDevice(): Promise<void> {
        // 1. 获取设备 IP 地址
        const host = await vscode.window.showInputBox({
          prompt: '请输入 iOS 设备的 IP 地址',
          placeHolder: '例如: 192.168.1.100',
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'IP 地址不能为空';
            }
            // 简单的 IP 格式验证
            const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipPattern.test(value.trim())) {
              return '请输入有效的 IP 地址格式';
            }
            return null;
          },
        });

        if (!host) {
          return;
        }

        // 2. 执行连接（端口固定 8820）
        const success = await iosDebugService.connectDevice(host.trim(), DEFAULT_IOS_DEBUG_PORT);

        if (success) {
          vscode.window.showInformationMessage(`成功连接到 iOS 设备 ${host}`);
        } else {
          vscode.window.showErrorMessage(`连接 iOS 设备 ${host} 失败`);
        }
      }
    })
  );

  return disposables;
}

async function connectWireless(
  outputChannel: OutputChannel,
  configService: ConfigService,
  adbPath: string
): Promise<void> {
  const connectMethods = ['IP地址和端口', 'AutoGo远程调试配对码', '无线调试配对码 (Android 11+)'];
  const debugMode = configService.debugMode;

  const selectedMethod = await vscode.window.showQuickPick(connectMethods, {
    placeHolder: '请选择连接方式',
  });

  if (!selectedMethod) {
    outputChannel.success('用户取消了连接方式选择');
    return;
  }

  let connectionString = '';
  let isUsingPairingCode = false;
  let pairingCodeInput: string | undefined;

  if (selectedMethod === 'IP地址和端口') {
    const ipAddress = await vscode.window.showInputBox({
      placeHolder: '192.168.1.100:5555',
      prompt: '请输入设备IP地址和端口（格式：IP:端口）',
    });
    if (!ipAddress) {
      outputChannel.success('用户取消了IP地址输入');
      return;
    }
    if (!ipAddress.includes(':') || ipAddress.includes(';')) {
      outputChannel.error('无效的IP地址格式，请使用冒号(:)作为分隔符，例如: 192.168.1.100:5555');
      return;
    }
    connectionString = ipAddress;
    isUsingPairingCode = false;
  } else if (selectedMethod === 'AutoGo远程调试配对码') {
    const pairingCode = await vscode.window.showInputBox({
      placeHolder: '12345',
      prompt: '请输入AutoGo服务配对码',
    });
    if (!pairingCode) {
      outputChannel.success('用户取消了配对码输入');
      return;
    }
    if (!/^\d{5}$/.test(pairingCode)) {
      outputChannel.error('无效的配对码格式，请输入5位数字');
      return;
    }
    connectionString = `api.autogo.cc:${pairingCode}`;
    isUsingPairingCode = false;
  } else if (selectedMethod === '无线调试配对码 (Android 11+)') {
    const pairAddress = await vscode.window.showInputBox({
      placeHolder: '例如: 192.168.1.100:37000',
      prompt: '请输入设备上显示的IP地址和配对端口',
    });
    if (!pairAddress || !pairAddress.includes(':')) {
      outputChannel.error('无效的配对地址格式，请确保包含IP和端口 (例如: 192.168.1.100:37000)');
      return;
    }

    const pairingCodeInputResult = await vscode.window.showInputBox({
      placeHolder: '123456',
      prompt: '请输入设备上显示的无线调试配对码',
    });
    if (!pairingCodeInputResult || !/^\d{5,6}$/.test(pairingCodeInputResult)) {
      outputChannel.error('无效的配对码格式，请输入5或6位数字。');
      return;
    }
    pairingCodeInput = pairingCodeInputResult;

    isUsingPairingCode = true;
    connectionString = pairAddress;
  } else {
    outputChannel.success('未知的连接方式');
    return;
  }

  try {
    if (isUsingPairingCode) {
      if (!pairingCodeInput) {
        outputChannel.error('内部错误：配对码未定义但需要执行配对。');
        return;
      }
      const pairArgs = ['pair', connectionString, pairingCodeInput];
      outputChannel.log(`尝试执行 ADB Pair: ${adbPath} ${pairArgs.join(' ')}`);

      const pairProcess = child_process.spawn(`\"${adbPath}\"`, pairArgs, { shell: true });

      let pairOutput = '';
      let pairErrorOutput = '';

      pairProcess.stdout.on('data', (data) => {
        const dataStr = data.toString();
        outputChannel.appendRaw(dataStr);
        pairOutput += dataStr.trim();
      });
      pairProcess.stderr.on('data', (data) => {
        const dataStr = data.toString();
        outputChannel.appendRaw(dataStr);
        pairErrorOutput += dataStr.trim();
      });

      const pairSuccess = await new Promise<boolean>((resolve) => {
        pairProcess.on('close', (code) => {
          if (pairOutput.toLowerCase().includes('successfully paired')) {
            outputChannel.success(`成功与设备配对: ${connectionString}`);
            resolve(true);
          } else {
            const failureMsg = pairErrorOutput || pairOutput || `配对命令执行失败，退出码: ${code}`;
            outputChannel.error(`配对设备 ${connectionString} 失败: ${failureMsg}`);
            resolve(false);
          }
        });
        pairProcess.on('error', (err) => {
          outputChannel.error(`启动 adb pair 命令失败: ${err.message}`);
          resolve(false);
        });
      });

      if (!pairSuccess) {
        return;
      }

      const ipOnly = connectionString.split(':')[0];
      const connectPort = await vscode.window.showInputBox({
        placeHolder: '5555',
        prompt: `配对成功！请输入 ${ipOnly} 的连接端口 (无线调试端口，例如 5555)`,
        value: '5555',
      });

      if (!connectPort || !/^\d+$/.test(connectPort)) {
        outputChannel.error('无效的连接端口号。');
        return;
      }
      connectionString = `${ipOnly}:${connectPort}`;
      outputChannel.success(`准备使用地址连接: ${connectionString}`);
    }

    if (!connectionString) {
      outputChannel.error('无法确定连接地址。');
      return;
    }

    const connectSuccess = await attemptAdbConnection(connectionString, adbPath, outputChannel, configService);
    if (!connectSuccess && debugMode) {
      outputChannel.log('ADB 连接尝试未成功。');
    }
  } catch (error) {
    const errorMsg = `连接设备时发生异常: ${error instanceof Error ? error.message : String(error)}`;
    outputChannel.error(errorMsg);
  }
}

async function attemptAdbConnection(
  deviceAddress: string,
  adbPath: string,
  outputChannel: OutputChannel,
  configService: ConfigService
): Promise<boolean> {
  const debugMode = configService.debugMode;

  if (debugMode) {
    outputChannel.log('尝试先杀死并重启ADB服务以确保状态正常');
  }

  try {
    await new Promise<void>((resolve) => {
      const killProcess = child_process.spawn(`\"${adbPath}\" kill-server`, [], { shell: true });

      killProcess.on('close', () => {
        if (debugMode) {
          outputChannel.log('ADB服务已关闭');
        }
        resolve();
      });

      killProcess.on('error', (err) => {
        if (debugMode) {
          outputChannel.warn(`杀死ADB服务失败: ${err.message}`);
        }
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      const startProcess = child_process.spawn(`\"${adbPath}\" start-server`, [], { shell: true });

      startProcess.on('close', () => {
        if (debugMode) {
          outputChannel.log('ADB服务已启动');
        }
        resolve();
      });

      startProcess.on('error', (err) => {
        if (debugMode) {
          outputChannel.warn(`启动ADB服务失败: ${err.message}`);
        }
        resolve();
      });
    });
  } catch (error) {
    if (debugMode) {
      outputChannel.warn(`重置ADB服务时出错: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  outputChannel.log(`尝试连接到: ${deviceAddress} .....`);
  const connectCommand = `\"${adbPath}\" connect ${deviceAddress}`;

  if (debugMode) {
    outputChannel.log(`执行连接命令: ${connectCommand}`);
  }

  return new Promise<boolean>((resolve) => {
    const connectProcess = child_process.spawn(connectCommand, [], { shell: true });

    let outputData = '';
    connectProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      outputChannel.appendRaw(dataStr);
      outputData += dataStr.trim();
    });

    let errorData = '';
    connectProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      outputChannel.appendRaw(dataStr);
      errorData += dataStr.trim();
    });

    connectProcess.on('close', async (code) => {
      const lowerOutput = outputData.toLowerCase();
      if (lowerOutput.includes('connected to') || lowerOutput.includes('already connected')) {
        if (lowerOutput.includes('already connected')) {
          outputChannel.success(`设备 ${deviceAddress} 已连接`);
        } else {
          outputChannel.success(`成功连接到设备: ${deviceAddress}`);
        }
        try {
          await vscode.workspace
            .getConfiguration(CONFIG_SECTION)
            .update('selectedDevice', deviceAddress, vscode.ConfigurationTarget.Global);
          if (debugMode) {
            outputChannel.log(`配置已更新: selectedDevice = ${deviceAddress}`);
          }
        } catch (updateError) {
          outputChannel.error(
            `更新设备配置失败: ${updateError instanceof Error ? updateError.message : String(updateError)}`
          );
        }
        resolve(true);
      } else {
        const combinedOutput = (outputData + ' ' + errorData).toLowerCase();

        if (
          combinedOutput.includes('daemon not running') ||
          combinedOutput.includes('daemon still not running') ||
          combinedOutput.includes('cannot connect to daemon')
        ) {
          outputChannel.warn('检测到ADB守护进程问题，尝试重启ADB服务');

          try {
            await new Promise<void>((resolveRestart) => {
              const killProcess = child_process.spawn(`\"${adbPath}\" kill-server`, [], { shell: true });
              killProcess.on('close', () => resolveRestart());
              killProcess.on('error', () => resolveRestart());
            });

            await new Promise<void>((resolveRestart) => {
              const startProcess = child_process.spawn(`\"${adbPath}\" start-server`, [], { shell: true });
              startProcess.on('close', () => resolveRestart());
              startProcess.on('error', () => resolveRestart());
            });

            setTimeout(async () => {
              outputChannel.log('重新尝试连接...');
              const retryConnectProcess = child_process.spawn(`\"${adbPath}\" connect ${deviceAddress}`, [], { shell: true });

              let retryOutput = '';
              retryConnectProcess.stdout.on('data', (data) => {
                const dataStr = data.toString();
                outputChannel.appendRaw(dataStr);
                retryOutput += dataStr.trim();
              });

              retryConnectProcess.on('close', async () => {
                if (
                  retryOutput.toLowerCase().includes('connected to') ||
                  retryOutput.toLowerCase().includes('already connected')
                ) {
                  outputChannel.success(`重启ADB后成功连接到设备: ${deviceAddress}`);
                  try {
                    await vscode.workspace
                      .getConfiguration(CONFIG_SECTION)
                      .update('selectedDevice', deviceAddress, vscode.ConfigurationTarget.Global);
                  } catch (updateError) {
                    outputChannel.error(
                      `更新设备配置失败: ${updateError instanceof Error ? updateError.message : String(updateError)}`
                    );
                  }
                  resolve(true);
                } else {
                  outputChannel.error(`重启ADB后仍然无法连接到设备: ${deviceAddress}`);
                  resolve(false);
                }
              });

              retryConnectProcess.on('error', () => {
                outputChannel.error('重启ADB后执行连接命令失败');
                resolve(false);
              });
            }, 1000);
          } catch (restartError) {
            outputChannel.error(`重启ADB服务失败: ${restartError instanceof Error ? restartError.message : String(restartError)}`);
            resolve(false);
          }
        } else {
          let errorMessage = `连接失败 (退出码: ${code})。`;
          if (combinedOutput.includes('10060') || combinedOutput.includes('timed out')) {
            errorMessage = `无法连接到设备 ${deviceAddress} (连接超时)。\n请检查:\n1. IP/主机名是否正确\n2. 设备与电脑是否在同一网络中\n3. 设备的网络连接是否稳定\n4. 是否有防火墙阻止连接`;
          } else if (combinedOutput.includes('10061') || combinedOutput.includes('积极拒绝')) {
            errorMessage = `设备 ${deviceAddress} 拒绝连接。\n请确认:\n1. 设备已开启网络ADB调试\n2. 端口号是否正确\n3. 如有安全软件，是否阻止了ADB连接`;
          } else if (combinedOutput.includes('failed to connect') || combinedOutput.includes('bad port number')) {
            errorMessage = `连接到设备 ${deviceAddress} 失败。\n可能原因:\n1. 连接参数不正确\n2. 设备未开启网络ADB调试\n3. 端口号格式错误\n\n请尝试:\n- 使用 adb devices 命令查看已连接设备\n- 在设备上关闭并重新打开USB调试选项`;
          } else if (combinedOutput.includes('unauthorized') || combinedOutput.includes('not authorized')) {
            errorMessage = `设备 ${deviceAddress} 未授权。\n请在设备上:\n1. 查看是否有授权提示并点击\"允许\"\n2. 如无提示，请在开发者选项中撤销USB调试授权后重试\n3. 重启设备后再次尝试连接`;
          } else if (combinedOutput.includes('offline')) {
            errorMessage = `设备 ${deviceAddress} 处于离线状态。\n建议:\n1. 断开并重新连接设备\n2. 重启设备\n3. 更换USB端口或数据线\n4. 如为无线连接，检查网络连接是否稳定`;
          } else if (errorData) {
            errorMessage += `\n错误信息: ${errorData}\n\n建议尝试:\n- 重新启动ADB服务\n- 重启设备\n- 检查设备的开发者选项设置`;
          } else if (outputData) {
            errorMessage += `\n输出信息: ${outputData}\n\n建议尝试:\n- 重新启动ADB服务\n- 重启设备\n- 检查设备的开发者选项设置`;
          }
          outputChannel.error(errorMessage);
          resolve(false);
        }
      }
    });

    connectProcess.on('error', (err) => {
      outputChannel.error(`启动 adb connect 命令失败: ${err.message}`);
      resolve(false);
    });
  });
}
