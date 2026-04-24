import * as path from 'path';
import * as cp from 'child_process';
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests,
} from '@vscode/test-electron';

const GO_EXTENSION_ID = 'golang.go';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../..');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
    const [cliPath, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
    const installResult = cp.spawnSync(
      cliPath,
      [...cliArgs, '--install-extension', GO_EXTENSION_ID, '--force'],
      {
        encoding: 'utf-8',
        stdio: 'inherit',
        shell: process.platform === 'win32',
      },
    );

    if (installResult.status !== 0) {
      throw new Error(`安装依赖扩展失败: ${GO_EXTENSION_ID}`);
    }

    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv: {
        AUTOGO_SKIP_INITIAL_CHECKS: '1',
      },
    });
  } catch (error) {
    console.error('集成测试运行失败:', error);
    process.exit(1);
  }
}

main();
