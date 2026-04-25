export const USER_MESSAGES = {
  workspaceNotFound: '未找到工作区，无法确定项目根目录',
  deviceNotSelected: '未选择设备，请先连接设备',
  noIosDeviceConnected: '没有已连接的 iOS 设备，请先执行“连接设备”',
  helpFetchFailed: '获取帮助失败',
  nodeAssistantOpenFailed: '打开节点助手失败',
} as const;

export function formatDeviceNotConnected(device: string): string {
  return `设备 ${device} 未连接，请先连接设备`;
}

export function formatDeviceConnectionCheckFailed(device: string): string {
  return `检查设备 ${device} 连接状态失败`;
}

export function formatArtifactNotFound(artifactPath: string): string {
  return `找不到产物: ${artifactPath}`;
}

export function formatFileNotFound(filePath: string): string {
  return `文件不存在: ${filePath}`;
}
