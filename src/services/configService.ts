import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Define interfaces for complex configuration types if necessary
export interface CustomCommand {
    label: string;
    command: string;
}

export interface CustomFile {
    label: string;
    path: string;
}

export interface CustomUrl {
    label: string;
    url: string;
}

export interface ApkArchitectures extends Record<string, boolean> {
    'arm64-v8a': boolean;
    'x86_64': boolean;
    'x86': boolean;
}

// Export the config section name as well
export const CONFIG_SECTION = 'AutoGo';

/**
 * Service class to manage access to the extension's configuration settings.
 */
export class ConfigService {
    private getConfig() {
        return vscode.workspace.getConfiguration(CONFIG_SECTION);
    }

    get debugMode(): boolean {
        return this.getConfig().get<boolean>('debugMode', false);
    }

    get adbPath(): string {
        const configured = this.getConfig().get<string>('adbPath', '').trim();
        if (configured && this.isValidAdbPath(configured)) {
            return configured;
        }

        const envPath = this.getAdbPathFromEnv();
        if (envPath) {
            return envPath;
        }

        return configured;
    }

    get selectedDevice(): string {
        return this.getConfig().get<string>('selectedDevice', '');
    }

    get packso(): boolean {
        return this.getConfig().get<boolean>('packso', false);
    }

    get apkArchitectures(): ApkArchitectures {
        const defaultArchs: ApkArchitectures = {
            'arm64-v8a': true,
            'x86_64': true,
            'x86': true
        };
        return this.getConfig().get<ApkArchitectures>('apkArchitectures', defaultArchs);
    }

    get customCommands(): CustomCommand[] {
        return this.getConfig().get<CustomCommand[]>('customCommands', []);
    }

    get customFiles(): CustomFile[] {
        return this.getConfig().get<CustomFile[]>('customFiles', []);
    }

    get customUrls(): CustomUrl[] {
        return this.getConfig().get<CustomUrl[]>('customUrls', []);
    }

    get showLogTime(): boolean {
        return this.getConfig().get<boolean>('showLogTime', true);
    }

    get showContextMenu(): boolean {
        return this.getConfig().get<boolean>('showContextMenu', true);
    }

    get targetPlatform(): 'android' | 'ios' {
        return this.getConfig().get<'android' | 'ios'>('targetPlatform', 'android');
    }

    get sdkChangelogUrl(): string {
        return this.getConfig().get<string>('sdkChangelogUrl', '').trim();
    }

    get sdkDownloadBaseUrl(): string {
        return this.getConfig().get<string>('sdkDownloadBaseUrl', '').trim();
    }

    private getAdbPathFromEnv(): string {
        const exeName = process.platform === 'win32' ? 'adb.exe' : 'adb';
        const candidates = new Set<string>();
        const directEnv = this.firstEnvValue(['ADB_PATH', 'ADB']);
        if (directEnv) {
            const normalized = this.normalizeAdbCandidate(directEnv, exeName);
            if (normalized) {
                candidates.add(normalized);
            }
        }

        const sdkRoot = this.firstEnvValue(['ANDROID_SDK_ROOT', 'ANDROID_HOME', 'ANDROID_SDK_HOME']);
        if (sdkRoot) {
            const normalized = this.normalizeAdbCandidate(
                path.join(sdkRoot, 'platform-tools'),
                exeName,
            );
            if (normalized) {
                candidates.add(normalized);
            }
        }

        const pathValue = this.firstEnvValue(['PATH']) || '';
        const delimiter = process.platform === 'win32' ? ';' : ':';
        for (const entry of pathValue.split(delimiter)) {
            const normalized = this.normalizeAdbCandidate(entry, exeName);
            if (normalized) {
                candidates.add(normalized);
            }
        }

        for (const candidate of candidates) {
            if (this.isValidAdbPath(candidate)) {
                return candidate;
            }
        }

        return '';
    }

    private firstEnvValue(keys: string[]): string | undefined {
        const lookup = new Set(keys.map((key) => key.toLowerCase()));
        for (const [key, value] of Object.entries(process.env)) {
            if (!value || !value.trim()) {
                continue;
            }
            if (lookup.has(key.toLowerCase())) {
                return value.trim();
            }
        }
        return undefined;
    }

    private normalizeAdbCandidate(value: string, exeName: string): string | null {
        const trimmed = value.trim().replace(/^"(.*)"$/, '$1');
        if (!trimmed) {
            return null;
        }
        const lowered = trimmed.toLowerCase();
        const exeLower = exeName.toLowerCase();
        if (lowered.endsWith(`/${exeLower}`) || lowered.endsWith(`\\${exeLower}`)) {
            return trimmed;
        }
        return path.join(trimmed, exeName);
    }

    isValidAdbPath(candidate: string): boolean {
        try {
            const stat = fs.statSync(candidate);
            return !stat.isDirectory() && stat.size > 0;
        } catch {
            return false;
        }
    }

    /**
     * Updates the ADB path configuration setting globally.
     * @param newPath The new absolute path to the adb executable.
     */
    async updateAdbPath(newPath: string): Promise<void> {
        try {
            await vscode.workspace.getConfiguration(CONFIG_SECTION).update('adbPath', newPath, vscode.ConfigurationTarget.Global);
            // Optional: Log success if you have an output channel available here,
            // or rely on the caller to log success.
        } catch (error) {
            console.error(`Failed to update ${CONFIG_SECTION}.adbPath:`, error);
            // Re-throw the error so the caller knows it failed
            throw new Error(`Failed to update ADB path configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Generic method to get any configuration value
     */
    get<T>(key: string, defaultValue: T): T {
        return this.getConfig().get<T>(key, defaultValue);
    }

    /**
     * Get the entire configuration section
     */
    getSection(): any {
        return this.getConfig();
    }

    /**
     * Get all configuration values
     */
    getAll(): any {
        const config = this.getConfig();
        const result: any = {};
        
        // Get all known configuration keys
        const keys = [
            'debugMode', 'adbPath', 'selectedDevice', 'packso',
            'apkArchitectures', 'customCommands', 'customFiles', 'customUrls',
            'showLogTime', 'showContextMenu', 'targetPlatform',
            'sdkChangelogUrl', 'sdkDownloadBaseUrl'
        ];
        
        for (const key of keys) {
            result[key] = config.get(key);
        }
        
        return result;
    }

    /**
     * Update a configuration value
     */
    async update(key: string, value: any, target?: vscode.ConfigurationTarget): Promise<void> {
        try {
            await vscode.workspace.getConfiguration(CONFIG_SECTION).update(key, value, target || vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error(`Failed to update ${CONFIG_SECTION}.${key}:`, error);
            throw new Error(`Failed to update configuration ${key}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Reset a configuration value to its default
     */
    async reset(key?: string): Promise<void> {
        try {
            if (key) {
                await vscode.workspace.getConfiguration(CONFIG_SECTION).update(key, undefined, vscode.ConfigurationTarget.Global);
            } else {
                // Reset all configuration
                await vscode.workspace.getConfiguration(CONFIG_SECTION).update('', undefined, vscode.ConfigurationTarget.Global);
            }
        } catch (error) {
            console.error(`Failed to reset ${CONFIG_SECTION}${key ? '.' + key : ''}:`, error);
            throw new Error(`Failed to reset configuration${key ? ' ' + key : ''}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Add methods for other configuration settings if needed in the future
}

// Optional: Export a single instance (singleton pattern)
// export const configService = new ConfigService(); 
