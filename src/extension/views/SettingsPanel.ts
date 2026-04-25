import * as vscode from 'vscode';
import { getNonce } from '../../utils/getNonce'; // Helper to generate nonces for CSP
import { OutputChannel, getOutputChannel } from '../../services/outputChannel'; // Import OutputChannel type
import * as fs from 'fs';
import { LogPanelManager } from './logPanelManager'; // Import LogPanelManager
import { ConfigService } from '../../services/configService'; // Import ConfigService
import { ArtifactStore } from '../../app/services/artifactStore';

// Define types for custom items
interface CustomCommandItem { label: string; command: string; }
interface CustomFileItem { label: string; path: string; }
interface CustomUrlItem { label: string; url: string; }

export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _outputChannel: OutputChannel; // Store output channel instance
    private readonly _context: vscode.ExtensionContext; // Store context
    private _configService: ConfigService;
    private _artifactStore: ArtifactStore;

    private constructor(
        panel: vscode.WebviewPanel,
        context: vscode.ExtensionContext,
        outputChannel: OutputChannel,
        configService: ConfigService,
        artifactStore: ArtifactStore,
        agExecutablePath: string,
    ) {
        this._panel = panel;
        this._context = context; // Store context
        this._extensionUri = context.extensionUri;
        this._outputChannel = outputChannel; // Assign output channel
        this._configService = configService; // Store configService
        this._artifactStore = artifactStore;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'browseAdbPath':
                        await this.handleBrowseAdbPath();
                        return;
                    case 'installAdb':
                        await this.handleInstallAdb();
                        return;
                    case 'saveAllSettings': // New handler for saving all settings
                        await this.handleSaveAllSettings(message.payload);
                        return;
                    case 'webviewReady':
                        this._handleWebviewReady();
                        return;
                    case 'closePanel': // Handle close request from webview
                        this.dispose();
                        return;
                    case 'error': // Handle errors reported from webview
                        this._outputChannel.error(`Webview Error: ${message.text}`);
                        return;
                    case 'info': // Handle info messages from webview
                        // Only log info messages in debug mode
                        if (this._configService.debugMode) {
                            this._outputChannel.log(`Webview Info: ${message.text}`);
                        }
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static render(
        context: vscode.ExtensionContext,
        outputChannel: OutputChannel,
        configService: ConfigService,
        artifactStore: ArtifactStore,
        agExecutablePath: string,
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            // If panel exists, update it with current settings
            SettingsPanel.currentPanel._update();
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'autoGoSettings', // Identifies the type of the webview. Used internally
            'AutoGo 设置', // Title of the panel displayed to the user
            column || vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                // Enable javascript in the webview
                enableScripts: true,
                // Restrict the webview to only loading content from our extension's output directory.
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-ui')]
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(
            panel,
            context,
            outputChannel,
            configService,
            artifactStore,
            agExecutablePath,
        );
    }

    // Static method to post messages (e.g., after ADB path update from outside)
    public static postMessageToWebview(message: any) {
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.webview.postMessage(message);
        }
    }

    private _debugLog(...args: unknown[]) {
        if (this._configService.debugMode) {
            console.log(...args);
        }
    }

    public dispose() {
        SettingsPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _update() {
        const webview = this._panel.webview;
        this._panel.title = 'AutoGo 设置';
        this._panel.webview.html = this._getHtmlForWebview(webview);
        this._webviewReady = false;
        this._pendingSettings = null;
    }

    private _webviewReady = false;
    private _pendingSettings: any = null;

    private _sendSettingsToWebview() {
        if (!this._panel || !this._panel.webview) {
            return;
        }
        const config = vscode.workspace.getConfiguration('AutoGo');
        const currentSettings = {
            packso: config.get<boolean>('packso', false),
            codeObfuscation: config.get<boolean>('codeObfuscation', false),
            adbPath: config.get<string>('adbPath', ''),
            apkArchitectures: config.get<object>('apkArchitectures', { 'arm64-v8a': true, 'x86_64': true, 'x86': true }),
            showLogTime: config.get<boolean>('showLogTime', true),
            showContextMenu: config.get<boolean>('showContextMenu', true),
            customCommands: config.get<CustomCommandItem[]>('customCommands', []),
            customFiles: config.get<CustomFileItem[]>('customFiles', []),
            customUrls: config.get<CustomUrlItem[]>('customUrls', [])
        };
        if (this._webviewReady) {
            this._panel.webview.postMessage({ command: 'loadSettings', payload: currentSettings });
        } else {
            this._pendingSettings = currentSettings;
        }
    }

    private _handleWebviewReady() {
        this._webviewReady = true;
        this._sendSettingsToWebview();
    }

    private async handleBrowseAdbPath() {
        const debugMode = this._configService.debugMode;
        if (debugMode) {
            this._outputChannel.log('Handling browseAdbPath request...'); // Add log
        }
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: '选择 adb.exe',
            filters: {
                // Limit to executables, adjust as needed for different OS
                'Executables': ['exe', 'bat', 'cmd'], // Windows example
                'All files': ['*']
            }
        };

        if (debugMode) {
            this._outputChannel.log('Showing open dialog...'); // Add log
        }
        const fileUri = await vscode.window.showOpenDialog(options);
        if (debugMode) {
            this._outputChannel.log(`Open dialog returned: ${fileUri}`); // Add log
        }

        if (fileUri && fileUri[0]) {
            const selectedPath = fileUri[0].fsPath;
            // Send the selected path back to the webview
            this._panel.webview.postMessage({ command: 'adbPathSelected', path: selectedPath });
            // Optionally update the config directly here or wait for saveSettings
            // await vscode.workspace.getConfiguration('AutoGo').update('adbPath', selectedPath, vscode.ConfigurationTarget.Global);
        } else {
            if (debugMode) {
                this._outputChannel.log('未选择 ADB 路径。');
            }
        }
    }

    private async handleInstallAdb() {
        try {
            this._outputChannel.success('开始下载 ADB...');
            const resolved = await this._artifactStore.ensureAdbInstalled();
            await this._configService.updateAdbPath(resolved.path);
            this._panel.webview.postMessage({ command: 'adbInstallResult', ok: true, path: resolved.path });
            this._outputChannel.success(`ADB 已配置完成: ${resolved.path}`);
        } catch (error) {
            const errorMsg = `ADB 自动下载失败: ${error instanceof Error ? error.message : String(error)}`;
            this._outputChannel.error(errorMsg);
            this._panel.webview.postMessage({ command: 'adbInstallResult', ok: false, message: errorMsg });
        }
    }

    // New handler function for saving all settings
    private async handleSaveAllSettings(payload: {
        packso: boolean;
        codeObfuscation: boolean;
        adbPath: string;
        apkArchitectures: object;
        showLogTime: boolean;
        showContextMenu: boolean;
        customCommands: CustomCommandItem[];
        customFiles: CustomFileItem[];
        customUrls: CustomUrlItem[];
    }) {
        const config = vscode.workspace.getConfiguration('AutoGo');
        const debugMode = config.get<boolean>('debugMode', false); // 获取 debugMode 配置

        try {
            // Update basic settings
            await config.update('packso', payload.packso, vscode.ConfigurationTarget.Global);
            await config.update('codeObfuscation', payload.codeObfuscation, vscode.ConfigurationTarget.Global);
            await config.update('adbPath', payload.adbPath, vscode.ConfigurationTarget.Global);
            await config.update('apkArchitectures', payload.apkArchitectures, vscode.ConfigurationTarget.Global);
            await config.update('showLogTime', payload.showLogTime, vscode.ConfigurationTarget.Global);
            await config.update('showContextMenu', payload.showContextMenu, vscode.ConfigurationTarget.Global);

            // Update custom items
            await config.update('customCommands', payload.customCommands, vscode.ConfigurationTarget.Global);
            await config.update('customFiles', payload.customFiles, vscode.ConfigurationTarget.Global);
            await config.update('customUrls', payload.customUrls, vscode.ConfigurationTarget.Global);

            // --- Debug Output Channel - 仅在 Debug 模式下输出 ---
            if (debugMode) {
                this._debugLog('[SettingsPanel] Settings updated in config.');
                this._outputChannel.log('[SettingsPanel] 配置更新完成，尝试记录成功消息...');
            }

            // -----------------------------------

            this._outputChannel.success('设置已保存');

            // --- Debug Output Channel - 仅在 Debug 模式下输出 ---
            if (debugMode) {
                this._debugLog('[SettingsPanel] Success message logged (supposedly).');
                this._outputChannel.log('[SettingsPanel] 成功消息已记录。');
            }
            // -----------------------------------

            // Close the panel after successful save
            this.dispose();
        } catch (error) {
            const errorMsg = `保存所有设置失败: ${error instanceof Error ? error.message : String(error)}`;
            this._outputChannel.error(errorMsg);
            // Optionally send an error message back to the webview if saving fails
            this._panel.webview.postMessage({ command: 'saveError', message: errorMsg });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-ui', 'settings', 'settings.js');
        // And the uri we use to load this script in the webview
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        // Local path to css styles
        const stylesPathMain = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-ui', 'settings', 'vscode.css');
        const stylesPathCustom = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-ui', 'settings', 'settings.css');

        // Uri to load styles into webview
        const stylesMainUri = webview.asWebviewUri(stylesPathMain);
        const stylesCustomUri = webview.asWebviewUri(stylesPathCustom);

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${stylesMainUri}" rel="stylesheet">
                <link href="${stylesCustomUri}" rel="stylesheet">
                <title>AutoGo 设置</title>
            </head>
            <body>
                <div class="settings-layout">
                    <aside class="settings-nav">
                        <div class="nav-header">
                            <div class="nav-title">AutoGo 设置</div>
                            <div class="nav-subtitle">基础与自定义</div>
                        </div>
                        <button class="nav-item is-active" type="button" data-section="general" aria-controls="section-general">基础设置</button>
                        <button class="nav-item" type="button" data-section="build" aria-controls="section-build">打包设置</button>
                        <button class="nav-item" type="button" data-section="commands" aria-controls="section-commands">自定义命令</button>
                        <button class="nav-item" type="button" data-section="files" aria-controls="section-files">自定义文件</button>
                        <button class="nav-item" type="button" data-section="urls" aria-controls="section-urls">自定义链接</button>
                    </aside>
                    <main class="settings-content">
                        <div class="settings-container">
                            <section id="section-general" class="settings-section is-active">
                                <h2>基础设置</h2>

                                <div class="setting-item">
                                    <label for="adbPath">ADB 路径</label>
                                    <div class="input-group">
                                        <input type="text" id="adbPath" name="adbPath" placeholder="例如: D:\\ADB\\adb.exe">
                                        <button id="browseButton" type="button">浏览</button>
                                        <button id="installAdbButton" type="button" class="secondary-button">自动下载</button>
                                    </div>
                                </div>

                                <div class="setting-item">
                                    <label for="showLogTime" class="main-label">显示日志时间</label>
                                    <div class="checkbox-container">
                                        <input type="checkbox" id="showLogTime" name="showLogTime">
                                        <label for="showLogTime" class="checkbox-label">在日志中显示时间戳（HH:MM:SS.mmm）</label>
                                    </div>
                                </div>

                                <div class="setting-item">
                                    <label for="showContextMenu" class="main-label">显示右键菜单</label>
                                    <div class="checkbox-container">
                                        <input type="checkbox" id="showContextMenu" name="showContextMenu">
                                        <label for="showContextMenu" class="checkbox-label">在编辑器右键菜单中显示 AutoGo 菜单</label>
                                    </div>
                                </div>
                            </section>

                            <section id="section-build" class="settings-section">
                                <h2>打包设置</h2>

                                <div class="setting-item setting-item--compact">
                                    <div class="checkbox-container checkbox-container--compact">
                                        <input type="checkbox" id="packsoEnabled" name="packsoEnabled">
                                        <label for="packsoEnabled" class="checkbox-label checkbox-label--primary">将 SO 依赖库嵌入到编译后的二进制文件</label>
                                    </div>
                                </div>

                                <div class="setting-item setting-item--compact">
                                    <div class="checkbox-container checkbox-container--compact">
                                        <input type="checkbox" id="codeObfuscationEnabled" name="codeObfuscationEnabled">
                                        <label for="codeObfuscationEnabled" class="checkbox-label checkbox-label--primary">代码混淆</label>
                                    </div>
                                </div>

                                <div class="setting-item">
                                    <label class="main-label">APK 架构选择</label>
                                    <div class="checkbox-group">
                                        <div>
                                            <input type="checkbox" id="arch-arm64-v8a" name="apkArchitectures" value="arm64-v8a">
                                            <label for="arch-arm64-v8a">arm64-v8a</label>
                                        </div>
                                        <div>
                                            <input type="checkbox" id="arch-x86_64" name="apkArchitectures" value="x86_64">
                                            <label for="arch-x86_64">x86_64</label>
                                        </div>
                                        <div>
                                            <input type="checkbox" id="arch-x86" name="apkArchitectures" value="x86">
                                            <label for="arch-x86">x86</label>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section id="section-commands" class="settings-section">
                                <h2>自定义终端命令</h2>
                                <div id="customCommandsList">
                                    <!-- Command items will be loaded here by JS -->
                                </div>
                                <div class="add-item-form" id="addCommandForm">
                                    <input type="text" id="newCommandLabel" placeholder="名称">
                                    <input type="text" id="newCommandValue" placeholder="命令">
                                    <button id="addCommandButton" type="button">添加</button>
                                </div>
                            </section>

                            <section id="section-files" class="settings-section">
                                <h2>自定义文件</h2>
                                <div id="customFilesList">
                                    <!-- File items will be loaded here by JS -->
                                </div>
                                <div class="add-item-form" id="addFileForm">
                                    <input type="text" id="newFileLabel" placeholder="名称">
                                    <input type="text" id="newFilePath" placeholder="路径">
                                    <button id="addFileButton" type="button">添加</button>
                                </div>
                            </section>

                            <section id="section-urls" class="settings-section">
                                <h2>自定义 URL 链接</h2>
                                <div id="customUrlsList">
                                    <!-- URL items will be loaded here by JS -->
                                </div>
                                <div class="add-item-form" id="addUrlForm">
                                    <input type="text" id="newUrlLabel" placeholder="名称">
                                    <input type="text" id="newUrlValue" placeholder="URL">
                                    <button id="addUrlButton" type="button">添加</button>
                                </div>
                            </section>

                            <div class="button-group">
                                <button id="saveButton" type="button">确定</button>
                                <button id="cancelButton" type="button">取消</button>
                            </div>
                        </div>
                    </main>
                </div>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private setSettings(config: vscode.WorkspaceConfiguration) {
        if (config.appPath && !fs.existsSync(config.appPath)) {
            this._outputChannel.warn(`警告: 应用程序路径不存在: ${config.appPath}`);
        }
        if (config.sdkPath && !fs.existsSync(config.sdkPath)) {
            this._outputChannel.warn(`警告: SDK 路径不存在: ${config.sdkPath}`);
        }
    }

} 
