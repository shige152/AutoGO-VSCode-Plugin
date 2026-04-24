import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as util from 'util'; // Import util
import { OutputChannel } from './outputChannel';
const exec = util.promisify(child_process.exec); // Promisify child_process.exec

export class AdbService {
    private context: vscode.ExtensionContext;
    private outputChannel: OutputChannel;
    private readonly getAdbPath: () => Promise<string | null>;

    constructor(
        context: vscode.ExtensionContext,
        outputChannel: OutputChannel,
        getAdbPath: () => Promise<string | null>,
    ) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.getAdbPath = getAdbPath;
    }

    public async getDevices(adbPathOverride?: string): Promise<string[]> {
        const adbPath = adbPathOverride ?? (await this.getAdbPath());
        if (!adbPath) {
            return [];
        }
        const command = `"${adbPath}" devices`;

        try {
            const { stdout, stderr } = await exec(command);

            if (stderr) {
                this.outputChannel.warn(`命令警告: ${stderr}`);
            }

            const devices = this.parseDevicesOutput(stdout, command);

            // 只在未找到设备时输出信息，成功找到设备的信息由调用方处理
            if (devices.length === 0) {
                this.outputChannel.log(`未找到设备。请检查ADB连接和设备状态。`);
            }

            return devices;

        } catch (error: any) {
            this.outputChannel.error(`执行命令失败: ${error.message}`);
            throw error;
        }
    }

    private parseDevicesOutput(stdout: string, command: string): string[] { // Updated function signature
        const lines = stdout.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0); // Split by various newlines, trim, and filter empty lines
        const devices: string[] = [];
        if (lines.length > 1) { // Check if there's a header and at least one device line
            lines.slice(1).forEach(line => {
                const parts = line.split(/\s+/); // Split by any whitespace
                if (parts.length > 0) {
                    const serial = parts[0]; // The first part is the serial
                    devices.push(serial);
                }
            });
        }
        return devices; // Return the device list
    }


    // 您可以在这里添加其他ADB相关的方法，例如 connect, disconnect 等
}
