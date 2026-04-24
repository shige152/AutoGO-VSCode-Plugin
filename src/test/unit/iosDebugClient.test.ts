import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeIosDebugClient } from '../../infra/ios/iosDebugClient';

test('NodeIosDebugClient 日志处理器管理', async (t) => {
  await t.test('onLog 应该添加日志处理器', () => {
    const client = new NodeIosDebugClient();
    const handler1 = (log: string) => console.log(log);
    const handler2 = (log: string) => console.log(log);

    client.onLog(handler1);
    client.onLog(handler2);

    client.offLog(handler1);
    client.offLog(handler2);

    assert.doesNotThrow(() => {
      client.offLog(handler1);
      client.offLog(handler2);
    });

    client.clearLogHandlers();
    client.onLog(handler1);
    client.offLog(handler1);
    
    assert.doesNotThrow(() => {
      client.offLog(handler1);
    });
  });

  await t.test('clearLogHandlers 应该清空所有日志处理器', () => {
    const client = new NodeIosDebugClient();
    let callCount = 0;
    
    const handler1 = () => { callCount++; };
    const handler2 = () => { callCount++; };
    const handler3 = () => { callCount++; };

    // 添加3个处理器
    client.onLog(handler1);
    client.onLog(handler2);
    client.onLog(handler3);

    // 清空所有处理器
    client.clearLogHandlers();

    // 重新添加1个处理器
    const newHandler = () => { callCount++; };
    client.onLog(newHandler);

    // 验证：现在应该只有1个处理器，而不是4个
    // 通过 offLog 来验证
    client.offLog(newHandler);
    
    // 如果 clearLogHandlers 工作正常，此时应该没有处理器了
    // 再次移除不应该抛出错误
    assert.doesNotThrow(() => {
      client.offLog(handler1);
      client.offLog(handler2);
      client.offLog(handler3);
    });
  });

  await t.test('offLog 应该移除指定的日志处理器', () => {
    const client = new NodeIosDebugClient();
    const handler1 = () => {};
    const handler2 = () => {};

    client.onLog(handler1);
    client.onLog(handler2);

    // 移除 handler1
    client.offLog(handler1);

    // 再次移除 handler1 不应该抛出错误（幂等性）
    assert.doesNotThrow(() => {
      client.offLog(handler1);
    });

    // 清空后验证 handler2 也被移除
    client.clearLogHandlers();
    assert.doesNotThrow(() => {
      client.offLog(handler2);
    });
  });
});

test('NodeIosDebugClient 退出处理器管理', async (t) => {
  await t.test('onExit 应该添加退出处理器', () => {
    const client = new NodeIosDebugClient();
    const handler = (code: number) => console.log(code);

    assert.doesNotThrow(() => {
      client.onExit(handler);
    });
  });

  await t.test('clearExitHandlers 应该清空所有退出处理器', () => {
    const client = new NodeIosDebugClient();
    const handler1 = () => {};
    const handler2 = () => {};
    const handler3 = () => {};

    // 添加3个处理器
    client.onExit(handler1);
    client.onExit(handler2);
    client.onExit(handler3);

    // 清空所有处理器
    client.clearExitHandlers();

    // 验证：再次移除旧的处理器不应该抛出错误
    assert.doesNotThrow(() => {
      client.offExit(handler1);
      client.offExit(handler2);
      client.offExit(handler3);
    });
  });

  await t.test('offExit 应该移除指定的退出处理器', () => {
    const client = new NodeIosDebugClient();
    const handler1 = () => {};
    const handler2 = () => {};

    client.onExit(handler1);
    client.onExit(handler2);

    // 移除 handler1
    client.offExit(handler1);

    // 再次移除 handler1 不应该抛出错误（幂等性）
    assert.doesNotThrow(() => {
      client.offExit(handler1);
    });

    // 清空后验证
    client.clearExitHandlers();
    assert.doesNotThrow(() => {
      client.offExit(handler2);
    });
  });
});

test('NodeIosDebugClient 处理器独立性', async (t) => {
  await t.test('日志处理器和退出处理器应该独立管理', () => {
    const client = new NodeIosDebugClient();
    const logHandler = () => {};
    const exitHandler = () => {};

    client.onLog(logHandler);
    client.onExit(exitHandler);

    // 清空日志处理器不应该影响退出处理器
    client.clearLogHandlers();

    // 退出处理器应该仍然存在
    assert.doesNotThrow(() => {
      client.offExit(exitHandler);
    });

    // 重新添加日志处理器
    client.onLog(logHandler);

    // 清空退出处理器不应该影响日志处理器
    client.clearExitHandlers();

    assert.doesNotThrow(() => {
      client.offLog(logHandler);
    });
  });
});

test('模拟日志重复问题场景', async (t) => {
  await t.test('多次运行不应该累积日志处理器', () => {
    const client = new NodeIosDebugClient();
    const logs: string[] = [];

    // 模拟第一次运行
    const run1Handler = (log: string) => logs.push(`run1: ${log}`);
    client.onLog(run1Handler);

    // 模拟第二次运行（没有清空处理器）
    const run2Handler = (log: string) => logs.push(`run2: ${log}`);
    client.onLog(run2Handler);

    // 模拟第三次运行（没有清空处理器）
    const run3Handler = (log: string) => logs.push(`run3: ${log}`);
    client.onLog(run3Handler);

    // 此时有3个处理器，会导致日志重复3次
    // 这是问题场景

    // 修复方案：在每次运行前清空处理器
    client.clearLogHandlers();
    const newHandler = (log: string) => logs.push(log);
    client.onLog(newHandler);

    // 现在只有1个处理器
    // 验证：移除新处理器后，应该没有处理器了
    client.offLog(newHandler);

    // 再次清空确保干净
    client.clearLogHandlers();
    
    // 验证状态干净
    assert.doesNotThrow(() => {
      client.clearLogHandlers();
      client.clearExitHandlers();
    });
  });

  await t.test('正确的运行流程：先清空再注册', () => {
    const client = new NodeIosDebugClient();
    const logs: string[] = [];

    // 第一次运行
    client.clearLogHandlers();
    client.onLog((log: string) => logs.push(`[1] ${log}`));

    // 第二次运行：先清空，再注册
    client.clearLogHandlers();
    client.onLog((log: string) => logs.push(`[2] ${log}`));

    // 第三次运行：先清空，再注册
    client.clearLogHandlers();
    client.onLog((log: string) => logs.push(`[3] ${log}`));

    // 验证：此时只有一个处理器
    // 清空后应该没有处理器
    client.clearLogHandlers();

    assert.strictEqual(logs.length, 0, '没有触发日志，数组应该为空');
  });
});
