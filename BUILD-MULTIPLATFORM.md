# AutoGO VSCode插件多平台构建指南

## 概述

AutoGO VSCode插件现在支持根据用户操作系统自动安装对应版本的功能。插件支持以下平台：

- **Windows x64**
- **Windows ARM64**
- **macOS x64**
- **macOS ARM64**

> **注意**: 已移除离线 ADB/AG 资源包，运行时按需下载到 Public 路径。同一操作系统的不同架构版本内容一致，但 VS Code 要求分别发布以支持不同架构。

## 资源说明

- `dist/extension.js` - 扩展主入口
- `dist/webview-ui/` - Webview 静态资源（日志视图与设置页）

## 构建方式

### 方式一：使用构建脚本（推荐）

#### Windows环境
```bash
# 运行多平台构建工具
.\build-multiplatform.bat
```

#### macOS/Linux环境
```bash
# 给脚本添加执行权限（仅第一次需要）
chmod +x build-multiplatform.sh

# 运行多平台构建工具
./build-multiplatform.sh
```

### 方式二：使用npm脚本

#### 构建单个平台
```bash
# Windows x64版本 (Intel/AMD)
npm run vsce:package:win32

# Windows ARM64版本 (ARM处理器)
npm run vsce:package:win32-arm64

# Windows所有版本 (x64 + ARM64)
npm run vsce:package:windows-all

# macOS Intel版本 (x64)
npm run vsce:package:darwin

# macOS Apple Silicon版本 (ARM64)
npm run vsce:package:darwin-arm64

# macOS所有版本 (Intel + Apple Silicon)
npm run vsce:package:macos-all
```

#### 构建所有平台
```bash
npm run vsce:package:all
```

#### 开发构建（包含所有资源）
```bash
npm run compile
npm run package
vsce package
```

## 技术实现

### 1. package.json配置
插件在`package.json`中定义了`targets`字段，指定支持的平台：

```json
"targets": [
  {
    "target": "win32-x64",
    "path": "."
  },
  {
    "target": "win32-arm64",
    "path": "."
  },
  {
    "target": "darwin-x64",
    "path": "."
  },
  {
    "target": "darwin-arm64",
    "path": "."
  }
]
```

### 2. Webpack资源打包
在`webpack.config.js`中拷贝通用静态资源，不再包含离线 ADB/AG 包：

```javascript
patterns: [
  { from: 'src/mcp', to: 'mcp' },
  { from: 'svg', to: 'svg' }
]
```

### 3. 交叉环境兼容性
使用`cross-env`包确保环境变量在Windows、macOS和Linux环境中都能正确设置。

## 发布流程

### 1. 本地测试
```bash
# 构建所有平台版本
npm run vsce:package:all

# 验证生成的VSIX文件
ls -la *.vsix
```

#### 生成的文件命名规则
构建完成后，VSIX文件会自动重命名为更有意义的格式：

- `AutoGo-v{版本号}-VScode-Windows-x64-{插件版本}.vsix`
- `AutoGo-v{版本号}-VScode-Windows-arm64-{插件版本}.vsix`
- `AutoGo-v{版本号}-VScode-Macos-x64-{插件版本}.vsix`
- `AutoGo-v{版本号}-VScode-Macos-arm64-{插件版本}.vsix`

例如：
- `AutoGo-v1.6.11-VScode-Windows-x64-1.0.6.vsix`
- `AutoGo-v1.6.11-VScode-Macos-arm64-1.0.6.vsix`

### 2. 发布到VS Code Marketplace

#### 方式一：使用npm脚本（推荐）
```bash
# 发布所有平台版本（需要先登录vsce）
npm run publish:win32-x64
npm run publish:win32-arm64
npm run publish:darwin-x64
npm run publish:darwin-arm64

# 或者发布所有平台
npm run publish:all
```

#### 方式二：手动发布（确保先构建）
```bash
# 发布Windows x64版本
npm run package:win32 && vsce publish --target win32-x64

# 发布Windows ARM64版本  
npm run package:win32-arm64 && vsce publish --target win32-arm64

# 发布macOS x64版本
npm run package:darwin && vsce publish --target darwin-x64

# 发布macOS ARM64版本
npm run package:darwin-arm64 && vsce publish --target darwin-arm64
```

vsce unpublish

### 3. 发布到Open VSX Registry

Open VSX是Eclipse基金会维护的VS Code扩展市场，是VS Code Marketplace的替代选择。

#### 准备工作
1. 安装ovsx工具：
```bash
npm install -g ovsx
```

2. 登录Open VSX：
```bash
ovsx login <namespace>
```

#### 方式一：使用npm脚本（推荐）
```bash
# 发布所有平台版本（需要先登录ovsx）
npm run ovsx:publish:win32-x64
npm run ovsx:publish:win32-arm64
npm run ovsx:publish:darwin-x64
npm run ovsx:publish:darwin-arm64

# 或者发布所有平台
npm run ovsx:publish:all
```

#### 方式二：手动发布（确保先构建）
```bash
# 发布Windows x64版本
npm run package:win32 && ovsx publish -t win32-x64

# 发布Windows ARM64版本  
npm run package:win32-arm64 && ovsx publish -t win32-arm64

# 发布macOS x64版本
npm run package:darwin && ovsx publish -t darwin-x64

# 发布macOS ARM64版本
npm run package:darwin-arm64 && ovsx publish -t darwin-arm64
```

#### 打包但不发布
如果只想打包而不发布到Open VSX：
```bash
# 打包所有平台版本
npm run ovsx:package:all

# 或者打包单个平台
npm run ovsx:package:win32
```

注意：`ovsx` 工具没有独立的 `package` 命令，因此我们使用 `vsce package` 来生成VSIX文件。这些文件可以用于：
1. 本地测试安装
2. 使用 `ovsx publish -i <vsix文件路径>` 发布到Open VSX
3. 分发给其他用户进行手动安装

### 4. 自动安装机制
当用户从VS Code Marketplace安装插件时，VS Code会自动根据用户的操作系统选择对应的平台版本进行下载和安装。

## 依赖要求

确保安装了以下开发依赖：

```bash
npm install --save-dev cross-env rimraf
```

对于Open VSX发布，还需要全局安装ovsx工具：

```bash
npm install -g ovsx
```

## 注意事项

1. **文件大小**: 由于平台特定打包，每个版本的VSIX文件大小会明显减小
2. **兼容性**: 确保 Public 目录有写入权限，必要时手动清理残留锁文件
3. **测试**: 建议在目标平台上测试每个版本的功能
4. **版本同步**: 所有平台版本应使用相同的版本号
5. **重要**: 发布时必须使用推荐的npm脚本或确保先构建对应平台，避免发布错误的平台文件

## 故障排除

### 问题：webpack构建失败
**解决方案**: 检查依赖安装与 webpack 配置是否正确

### 问题：VSCE打包失败
**解决方案**: 确保已安装vsce CLI工具：`npm install -g vsce`

### 问题：权限错误
**解决方案**: 在macOS/Linux上给shell脚本添加执行权限：`chmod +x build-multiplatform.sh`

### 问题：Open VSX发布失败
**解决方案**: 
1. 确保已安装ovsx工具：`npm install -g ovsx`
2. 确保已登录Open VSX：`ovsx login`
3. 使用推荐的npm脚本：`npm run ovsx:publish:win32-x64`
4. 或手动确保先构建：`npm run clean && npm run package:win32 && ovsx publish -t win32-x64`

## 贡献指南

1. 确保新功能在所有支持的平台上都能正常工作
2. 更新相应的平台特定资源文件
3. 测试多平台构建过程
4. 更新此文档以反映任何更改 
