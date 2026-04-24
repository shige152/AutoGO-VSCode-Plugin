import * as vscode from 'vscode';
import * as path from 'path';

// 定义树节点的数据结构
interface CommandItem {
    label: string; // 显示的名称
    tooltip: string; // 鼠标悬停提示
    icon?: string; // Codicon id or svg file name (optional)
    commandId?: string; // 关联的 VS Code 命令 ID (叶节点需要)
    children?: CommandItem[]; // 子节点 (父节点需要)
}

// 扩展 vscode.TreeItem 以包含我们的数据
export class AutoGoTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command, // 点击时执行的命令
        public readonly iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon,
        public readonly children?: CommandItem[] // 保留子节点定义，用于 getChildren
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.command = command;
        this.iconPath = iconPath;
    }
}

// 实现 TreeDataProvider
export class AutoGoTreeDataProvider implements vscode.TreeDataProvider<AutoGoTreeItem> {

    // 事件发射器，当树数据变化时通知 VS Code (我们暂时不需要，但接口要求)
    private _onDidChangeTreeData: vscode.EventEmitter<AutoGoTreeItem | undefined | null | void> = new vscode.EventEmitter<AutoGoTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AutoGoTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private treeData: CommandItem[];

    constructor(private context: vscode.ExtensionContext) {
        // 在这里定义完整的树状结构数据
        this.treeData = this.getTreeStructure();
    }

    // 返回 TreeItem 的 UI 表示
    getTreeItem(element: AutoGoTreeItem): vscode.TreeItem {
        return element;
    }

    // 返回元素的子节点
    getChildren(element?: AutoGoTreeItem): Thenable<AutoGoTreeItem[]> {
        if (element) {
            // 如果有父元素，返回其子节点
            return Promise.resolve(this.createTreeItems(element.children));
        } else {
            // 如果没有父元素，返回根节点
            return Promise.resolve(this.createTreeItems(this.treeData));
        }
    }

    // 将我们的 CommandItem 数据转换为 VS Code 需要的 AutoGoTreeItem
    private createTreeItems(items?: CommandItem[]): AutoGoTreeItem[] {
        if (!items) {
            return [];
        }

        return items.map(item => {
            const collapsibleState = item.children && item.children.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed // 有子节点，初始折叠
                : vscode.TreeItemCollapsibleState.None; // 没有子节点

            let command: vscode.Command | undefined = undefined;
            if (item.commandId) {
                command = {
                    command: item.commandId, // 命令 ID
                    title: item.label, // 命令标题 (通常与 label 相同)
                    tooltip: item.tooltip // 命令提示
                };
            }

            let iconPath: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon | undefined = undefined;
            if (item.icon) {
                if (item.icon.endsWith('.svg')) {
                    const iconUri = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'svg', item.icon);
                    iconPath = { light: iconUri, dark: iconUri };
                } else {
                    iconPath = new vscode.ThemeIcon(item.icon);
                }
            }

            const treeItem = new AutoGoTreeItem(
                item.label,
                item.tooltip,
                collapsibleState,
                command,
                iconPath,
                item.children
            );
            // 如果是父节点，给它一个 context value，可以用来控制右键菜单等（可选）
            if (item.children) {
                treeItem.contextValue = 'commandGroup';
            }

            return treeItem;
        });
    }

    // 定义树的静态结构
    private getTreeStructure(): CommandItem[] {
        return [
            {
                label: '核心操作',
                tooltip: '运行、停止和连接设备',
                icon: 'run',
                children: [
                    { label: '运行项目', tooltip: '运行当前 AutoGo 项目', icon: 'run', commandId: 'AutoGo.run' },
                    { label: '停止运行', tooltip: '停止当前运行的 AutoGo 项目', icon: 'debug-stop', commandId: 'AutoGo.stop' },
                    { label: '连接设备', tooltip: '通过 ADB 连接到设备', icon: 'device-mobile', commandId: 'AutoGo.connect' }
                ]
            },
            {
                label: '编译项目',
                tooltip: '编译项目到不同平台或格式',
                icon: 'build',
                children: [
                    { label: 'arm64-v8a', tooltip: '编译为 arm64-v8a 架构', icon: 'chip', commandId: 'AutoGo.compileARM64' },
                    { label: 'x86_64', tooltip: '编译为 x86_64 架构', icon: 'chip', commandId: 'AutoGo.compileAMD64' },
                    { label: 'x86', tooltip: '编译为 x86 架构', icon: 'chip', commandId: 'AutoGo.compileAMD' },
                    { label: 'APK', tooltip: '打包为 Android APK', icon: 'package', commandId: 'AutoGo.compileAPK' }
                ]
            },
             {
                label: '文件操作',
                tooltip: '推送文件、目录和初始化',
                icon: 'files',
                children: [
                    { label: '初始项目', tooltip: '初始化 AutoGo 项目结构', icon: 'new-folder', commandId: 'AutoGo.init' },
                    { label: '推送文件', tooltip: '推送选定文件到设备', icon: 'export', commandId: 'AutoGo.pushFile' },
                    { label: '推送目录', tooltip: '推送选定目录到设备', icon: 'cloud-upload', commandId: 'AutoGo.pushFolder' },
                    { label: '同步资源', tooltip: '同步工作区资源到设备', icon: 'sync', commandId: 'AutoGo.syncFiles' }
                ]
            },
            {
                label: '快捷配置',
                tooltip: '运行自定义命令、文件和链接',
                icon: 'tools',
                children: [
                    { label: '终端命令', tooltip: '运行预设的终端命令', icon: 'terminal', commandId: 'AutoGo.runCustomCommand' },
                    { label: '文件应用', tooltip: '打开预设的文件或应用', icon: 'file', commandId: 'AutoGo.runCustomFile' },
                    { label: '网页链接', tooltip: '打开预设的网页链接', icon: 'link-external', commandId: 'AutoGo.runCustomUrl' }
                ]
            },
            {
                label: '项目工具',
                tooltip: '其他项目相关工具',
                icon: 'circuit-board',
                children: [
                    { label: '节点助手', tooltip: '打开 AutoGo 节点助手', icon: 'circuit-board', commandId: 'AutoGo.nodeaid' }
                ]
            },
            {
                label: '设置',
                tooltip: '插件相关设置',
                icon: 'settings-gear',
                children: [
                    { label: '基础设置', tooltip: '打开 AutoGo 基础设置', icon: 'settings', commandId: 'AutoGo.settings' },
                    { label: '更新AutoGo版本', tooltip: '更新 AutoGo 到最新版本', icon: 'refresh', commandId: 'AutoGo.updateAutoGo' }
                ]
            }
        ];
    }
} 
