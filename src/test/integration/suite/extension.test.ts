import * as assert from 'assert';
import * as vscode from 'vscode';

const manifest = require('../../../../package.json') as { publisher: string; name: string };
const EXTENSION_ID = `${manifest.publisher}.${manifest.name}`;

async function activateExtension(): Promise<void> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `未找到扩展 ${EXTENSION_ID}`);
  await extension.activate();
  assert.ok(extension.isActive, '扩展未激活');
}

suite('AutoGo 扩展集成测试', function () {
  this.timeout(10000);

  test('扩展可以激活', async () => {
    await activateExtension();
  });

  test('核心命令已注册', async () => {
    await activateExtension();
    const commands = await vscode.commands.getCommands(true);
    const expected = ['AutoGo.run', 'AutoGo.updateAutoGo'];
    for (const command of expected) {
      assert.ok(commands.includes(command), `缺少命令: ${command}`);
    }
  });

  test('日志视图可以打开', async () => {
    await activateExtension();
    const commands = await vscode.commands.getCommands(true);
    const openContainerCommand = 'workbench.view.extension.autoGoLogContainer';
    assert.ok(commands.includes(openContainerCommand), '日志容器命令未注册');
    await vscode.commands.executeCommand(openContainerCommand);
  });
});
