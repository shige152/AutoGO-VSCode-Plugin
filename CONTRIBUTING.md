# 贡献指南

感谢你关注 AutoGo VS Code 扩展。
欢迎提交 Issue、文档改进、测试反馈与代码贡献。

## 贡献方式

- **缺陷报告**：提交包含复现步骤、预期行为、实际行为和环境信息的 Issue
- **功能建议**：在 Issue 或 Discussion 中说明使用场景与目标收益
- **代码贡献**：Fork 仓库、提交分支并发起 Pull Request
- **文档改进**：修订 README、CHANGELOG、SECURITY 或开发文档

## 本地开发

### 环境要求

- Node.js 18+
- VS Code 1.96.2+
- npm 9+

### 安装依赖

```bash
npm ci
```

### 常用命令

```bash
npm run lint
npm run test:unit
npm run package
npm run validate
```
扩展构建监听：
```bash
npm run watch
```

### 调试扩展


1. 使用 VS Code 打开仓库
2. 执行 `npm ci`
3. 按 `F5` 启动 Extension Development Host
4. 修改代码后重新加载扩展宿主进行验证

## 代码规范

- `src/extension` 允许依赖 `vscode`；其它层避免直接耦合 `vscode`
- `src/core` 保持纯逻辑，不依赖文件系统、网络或编辑器 API
- 通过 `src/app/ports` 做依赖抽象，基础设施实现放在 `src/infra`
- 优先编写可测试、可组合、职责单一的模块
- 保留必要注释，避免解释“代码显而易见的行为”

## Pull Request 要求

1. 基于最新主分支创建功能分支
2. 保持提交粒度清晰，提交信息建议使用 Conventional Commits
3. 提交前确保本地执行通过：

```bash
npm run validate
```

4. 如果修改了行为、命令、配置项或 UI，请同步更新相关文档
5. PR 描述中请包含：
   - 变更背景
   - 主要改动
   - 验证方式
   - 风险与兼容性说明（如有）

## 文档约定

- 对外文档尽量面向首次接触项目的开发者
- 命令、路径、文件名请使用反引号包裹
- 新增配置项时，需同时更新 `README.md` 与 `package.json` 配置描述

## 行为准则

参与本项目即表示同意遵守 [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)。

## License

提交到本仓库的代码默认按 [MIT License](./LICENSE) 发布。
