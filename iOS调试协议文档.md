# AutoGo iOS 调试协议文档

本文档描述 IDE 插件与 iOS 设备端应用之间的 TCP 通讯协议，用于实现文件同步、快速调试、运行项目和日志回传等功能。

---

## 1. 连接方式

| 项目 | 说明 |
|------|------|
| 传输层 | TCP |
| 端口 | **8820** |
| 角色 | IDE 为客户端，iOS 设备为服务端 |
| 设备发现 | 手动输入设备 IP 地址 |
| 最大并发客户端 | 8 |
| 握手 | 无应用层握手，连接建立后直接发送消息帧 |

```
IDE (客户端)                        iOS 设备 (服务端)
     |                                    |
     |---- TCP connect(设备IP:8820) ----->|
     |                                    |
     |     连接成功，可直接发送消息帧       |
```

---

## 2. 帧格式

所有消息共享统一的帧格式：

```
+--------+-----------------+------------------+
| 1 byte |     4 bytes     |    N bytes       |
|  type  | payload length  |    payload       |
+--------+-----------------+------------------+
```

| 字段 | 大小 | 编码 | 说明 |
|------|------|------|------|
| type | 1 字节 | uint8 | 消息类型 |
| payload length | 4 字节 | uint32, **大端序** (网络字节序) | 载荷长度，可以为 0 |
| payload | N 字节 | 取决于消息类型 | 载荷数据 |

---

## 3. 消息类型

| 常量名 | 值 | 方向 | 说明 |
|--------|-----|------|------|
| MSG_PUSH_FILE | 0x01 | IDE → 设备 | 推送文件 |
| MSG_FILE_ACK | 0x02 | 设备 → IDE | 文件推送 / 运行启动结果 |
| MSG_SYNC_DONE | 0x03 | IDE → 设备 | 文件同步完成通知 |
| MSG_SYNC_DONE_ACK | 0x04 | 设备 → IDE | 同步完成确认 |
| MSG_RUN | 0x05 | IDE → 设备 | 启动脚本运行 |
| MSG_STOP | 0x06 | IDE → 设备 | 停止运行中的脚本 |
| MSG_LOG | 0x07 | 设备 → IDE | 脚本日志输出 |
| MSG_EXIT | 0x08 | 设备 → IDE | 脚本进程退出 |

---

## 4. 各消息详细格式

### 4.1 MSG_PUSH_FILE (0x01) — IDE → 设备

用于将文件推送到设备。载荷包含文件路径和文件内容：

```
+------+-------------+----------+--------+----------+
| 0x01 | payloadLen  | pathLen  |  path  | fileData |
| 1B   | 4B (BE)     | 2B (BE)  |  NB    | MB       |
+------+-------------+----------+--------+----------+
```

| 字段 | 大小 | 编码 | 说明 |
|------|------|------|------|
| type | 1 字节 | 0x01 | 固定 |
| payloadLen | 4 字节 | uint32 大端 | = 2 + pathLen + fileSize |
| pathLen | 2 字节 | uint16 大端 | 路径字符串的字节长度 |
| path | pathLen 字节 | UTF-8 | 远程路径标识 |
| fileData | 剩余字节 | 原始二进制 | 文件完整内容 |

**远程路径映射规则**（设备端根据 path 值决定存储位置）：

| path 值 | 设备存储路径 |
|---------|-------------|
| `debug` | 调试二进制路径（Documents/debug） |
| `ios-debug.zip` | Documents/ios-debug.zip |
| `assets/xxx` | Documents/assets/xxx |
| `Documents/xxx` | Documents/xxx |
| `Frameworks/xxx.dylib` | Documents/xxx.dylib |

**响应**：设备处理完毕后发送 `MSG_FILE_ACK`。

**注意**：
- 文件以单次完整发送，不分块
- 推送 `.dylib` 文件时，设备会自动对其进行代码签名
- 推送完一个文件后应等待 ACK 再推送下一个

---

### 4.2 MSG_FILE_ACK (0x02) — 设备 → IDE

文件推送或运行启动的结果响应：

| 字段 | 大小 | 说明 |
|------|------|------|
| type | 1 字节 | 0x02 |
| payloadLen | 4 字节 | 载荷长度 |
| payload | N 字节 | UTF-8 字符串 |

**载荷内容**：

| 值 | 含义 |
|----|------|
| `OK` | 操作成功 |
| `ERR:invalid path` | 路径无效 |
| `ERR:open failed` | 文件打开失败 |
| `ERR:binary not found` | 调试二进制不存在 |
| `ERR:libgoeval.dylib not found` | eval 二进制不存在 |
| `ERR:ios-debug.zip not found` | 调试 zip 不存在 |
| `ERR:sign failed` | 代码签名失败 |
| `ERR:spawn failed` | 进程启动失败 |

---

### 4.3 MSG_SYNC_DONE (0x03) — IDE → 设备

通知设备文件同步已完成（所有文件已推送完毕）。

| 字段 | 大小 | 说明 |
|------|------|------|
| type | 1 字节 | 0x03 |
| payloadLen | 4 字节 | 0 |

---

### 4.4 MSG_SYNC_DONE_ACK (0x04) — 设备 → IDE

设备确认收到同步完成通知。

| 字段 | 大小 | 说明 |
|------|------|------|
| type | 1 字节 | 0x04 |
| payloadLen | 4 字节 | 2 |
| payload | 2 字节 | UTF-8 `"OK"` |

---

### 4.5 MSG_RUN (0x05) — IDE → 设备

指示设备启动脚本运行。

| 字段 | 大小 | 说明 |
|------|------|------|
| type | 1 字节 | 0x05 |
| payloadLen | 4 字节 | 模式字符串长度 |
| payload | N 字节 | UTF-8 模式字符串 |

**模式字符串**：

| 值 | 含义 |
|----|------|
| `"zip"` | eval 模式：通过 libgoeval.dylib 执行 ios-debug.zip |
| `"bin"` | 二进制模式：直接运行 debug 二进制 |

**响应**：设备发送 `MSG_FILE_ACK`（成功为 `"OK"`，失败为 `"ERR:..."`），随后开始日志流。

---

### 4.6 MSG_STOP (0x06) — IDE → 设备

停止当前运行中的脚本进程。

| 字段 | 大小 | 说明 |
|------|------|------|
| type | 1 字节 | 0x06 |
| payloadLen | 4 字节 | 0 |

设备收到后向进程发送 `SIGCONT` + `SIGKILL`，无响应帧。

---

### 4.7 MSG_LOG (0x07) — 设备 → IDE

脚本运行时的日志输出，逐行发送。

| 字段 | 大小 | 说明 |
|------|------|------|
| type | 1 字节 | 0x07 |
| payloadLen | 4 字节 | 日志行长度 |
| payload | N 字节 | UTF-8 日志文本（不含换行符） |

**说明**：
- 设备将脚本的 stdout/stderr 重定向到日志文件
- 后台线程逐行读取并广播给所有已连接的客户端
- 单行最大 4096 字节

---

### 4.8 MSG_EXIT (0x08) — 设备 → IDE

脚本进程退出通知。

| 字段 | 大小 | 说明 |
|------|------|------|
| type | 1 字节 | 0x08 |
| payloadLen | 4 字节 | 退出码字符串长度 |
| payload | N 字节 | UTF-8 退出码（十进制 ASCII，如 `"0"`、`"1"`） |

---

## 5. 操作流程

### 5.1 快速调试（eval 模式）

适用于推送源码 zip 并通过解释器运行的场景。

```
IDE                                        设备
 |                                           |
 |  1. 打包项目源码为 ios-debug.zip            |
 |                                           |
 |-- MSG_PUSH_FILE("ios-debug.zip", data) -->|
 |<-- MSG_FILE_ACK("OK") -------------------|
 |                                           |
 |-- MSG_RUN("zip") ----------------------->|
 |<-- MSG_FILE_ACK("OK") -------------------|
 |                                           |
 |<-- MSG_LOG("脚本输出行1") ----------------|
 |<-- MSG_LOG("脚本输出行2") ----------------|
 |<-- ...                                    |
 |<-- MSG_EXIT("0") ------------------------|
 |                                           |
 |-- MSG_STOP (可选，提前终止) ------------->|
```

**IDE 端操作步骤**：
1. 调用 `AG run -t ios` 命令打包项目源码为 `build/ios-debug.zip`
2. 通过 `MSG_PUSH_FILE` 推送 zip 到设备
3. 等待 `MSG_FILE_ACK("OK")`
4. 发送 `MSG_RUN("zip")`
5. 等待 `MSG_FILE_ACK("OK")` 确认启动成功
6. 持续接收 `MSG_LOG` 显示日志
7. 收到 `MSG_EXIT` 表示运行结束
8. 如需提前终止，发送 `MSG_STOP`

---

### 5.2 运行项目（二进制模式）

适用于推送编译好的二进制文件并直接运行的场景。

```
IDE                                        设备
 |                                           |
 |  1. 编译 iOS 二进制 (build/ios-release)     |
 |                                           |
 |-- MSG_PUSH_FILE("debug", binData) ------>|
 |<-- MSG_FILE_ACK("OK") -------------------|
 |                                           |
 |  2. 推送依赖的 dylib（如有）               |
 |-- MSG_PUSH_FILE("Frameworks/xx.dylib") ->|
 |<-- MSG_FILE_ACK("OK") -------------------|
 |                                           |
 |-- MSG_SYNC_DONE ----------------------->|
 |<-- MSG_SYNC_DONE_ACK("OK") -------------|
 |                                           |
 |-- MSG_RUN("bin") ----------------------->|
 |<-- MSG_FILE_ACK("OK") -------------------|
 |                                           |
 |<-- MSG_LOG("...") -----------------------|
 |<-- MSG_EXIT("0") ------------------------|
```

**IDE 端操作步骤**：
1. 调用 `AG build -t ios` 编译项目为二进制 `build/ios-release`
2. 通过 `MSG_PUSH_FILE("debug", ...)` 推送二进制到设备
3. 推送所有依赖 dylib（路径前缀 `Frameworks/`）
4. 发送 `MSG_SYNC_DONE` 通知同步完成
5. 发送 `MSG_RUN("bin")`
6. 接收日志和退出事件

---

## 6. 设备端 HTTP 接口（辅助）

设备同时在 **8989** 端口提供 HTTP API：

| 路径 | 方法 | 说明 |
|------|------|------|
| `/screenshot` | GET | 获取屏幕截图（PNG） |
| `/task?cmd=start` | GET | 启动脚本 |
| `/task?cmd=stop` | GET | 停止脚本 |
| `/float?cmd=show` | GET | 显示悬浮球 |
| `/float?cmd=hide` | GET | 隐藏悬浮球 |

此 HTTP 接口独立于 TCP 调试协议，不是实现调试功能的必要部分。

---

## 7. 实现注意事项

1. **字节序**：所有多字节整数均使用**大端序**（网络字节序），包括帧头的 payloadLen 和 MSG_PUSH_FILE 的 pathLen
2. **文件推送是同步的**：发送一个文件后必须等待 ACK 再发送下一个
3. **日志广播**：MSG_LOG 会广播给所有已连接的客户端
4. **进程管理**：MSG_STOP 发送 SIGCONT + SIGKILL，确保即使进程被暂停也能终止
5. **自动重启**：二进制模式下退出码 123 会触发设备端自动重启脚本，eval 模式不会
6. **dylib 签名**：推送 `.dylib` 文件时设备会自动进行代码签名，推送二进制不会
7. **连接保活**：建议设置 TCP keepalive（`socket.setKeepAlive(true)`）
8. **超时建议**：文件推送 ACK 等待 30 秒，运行 ACK 等待 15 秒
