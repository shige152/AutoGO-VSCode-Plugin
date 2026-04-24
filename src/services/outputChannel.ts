import * as vscode from 'vscode';
import * as path from 'path'; // Import path module
import * as fs from 'fs'; // Import fs module

// Regular expression to find file paths like main.go:35 or path/to/file.ext:12
// It looks for patterns that resemble file paths followed by a colon and line number.
// Examples: /path/to/file.go:123, C:\\Users\\User\\file.txt:45, ./relative/path.js:10
// Note: This regex might need adjustments for specific path formats or edge cases.
// Match either start of line (^) or whitespace (\s) before the path
// Exclude spaces from directory and file parts to prevent capturing timestamp parts
const filePathRegex = /(?:^|\s)((?:[a-zA-Z]:\\|\/)?(?:[^<>:"\\|?*\s\n\r]+[\\\/])*)([^<>:"\\|?*\s\n\r\/]+\.\w+):(\d+)/g;

// Function to generate nonce for Content Security Policy - moved outside the class
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Interface for structured log entries - ADD EXPORT
export interface LogEntry {
    type: 'log' | 'info' | 'warn' | 'error' | 'success' | 'raw';
    message: string;
    timestamp: number; // Store timestamp as number for easier sorting/filtering
}

export class OutputChannel implements vscode.Disposable { // Implement Disposable
    // Add state for log history
    private _logHistory: LogEntry[] = [];
    private readonly maxHistoryLength = 1000; // Limit history size

    // Add EventEmitter for log updates
    private _onDidLog = new vscode.EventEmitter<LogEntry>();
    public readonly onDidLog: vscode.Event<LogEntry> = this._onDidLog.event;

    // Keep name if needed, remove context dependency if possible
    constructor(private name: string) { 
        // Constructor simplified - no panel creation
    }

    // Method to get the history
    public getHistory(): ReadonlyArray<LogEntry> {
        return this._logHistory;
    }
    
    // Method to clear history
    public clearHistory(): void {
        this._logHistory = [];
        // Optionally, fire an event to notify listeners about the clear
        // this._onDidClear.fire(); 
    }

    // Central method to add log entries
    private addLogEntry(type: LogEntry['type'], message: string): void {
        const entry: LogEntry = {
            type,
            message,
            timestamp: Date.now()
        };
        
        this._logHistory.push(entry);
        
        // Trim history if it exceeds the limit
        if (this._logHistory.length > this.maxHistoryLength) {
            this._logHistory.shift(); // Remove the oldest entry
        }
        
        // Fire the event
        this._onDidLog.fire(entry);
    }

    // Public log methods now just call addLogEntry
    public log(message: string): void {
        this.addLogEntry('log', message);
    }

    public info(message: string): void {
        this.addLogEntry('info', message);
    }

    public warn(message: string): void {
        this.addLogEntry('warn', message);
    }

    public error(message: string): void {
        this.addLogEntry('error', message);
    }

    public success(message: string): void {
        this.addLogEntry('success', message);
    }

    /**
     * Appends raw text without standard log formatting.
     * @param message The raw text message to append.
     */
    public appendRaw(message: string): void {
        this.addLogEntry('raw', message);
    }

    // Remove panel-specific methods like show, formatMessage, postMessageToWebview, flushMessageQueue, getWebviewContent etc.
    // These will be handled by the UI components (LogPanelManager, LogViewProvider)

    // Implement dispose for the EventEmitter
    public dispose(): void {
        this._onDidLog.dispose();
    }

    // Keep formatting logic separate if needed by UI components
    // Maybe move formatMessage, getTimestamp, filePathRegex to a utility file?
    public static formatLogEntry(entry: LogEntry, showTimestamp: boolean = true): string {
        // 1. Sanitize the message first, regardless of type
        let sanitizedMessage = entry.message.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // 2. Apply file path link replacement to the sanitized message
        sanitizedMessage = sanitizedMessage.replace(filePathRegex, (match, dirPath, fileName, lineNumber, offset, string) => {
            // `match` is the whole match, e.g., " main.go:45" or " C:\\path\\file.go:12"
            // `dirPath` (group 1), `fileName` (group 2), `lineNumber` (group 3) are correct.
            const fullPath = dirPath ? dirPath + fileName : fileName;
            const normalizedPath = fullPath.replace(/\\/g, '/'); // Normalize to forward slashes
            const escapedPath = normalizedPath; // Forward slashes don't need escaping in data attributes
            const linkId = `filelink-${entry.timestamp}-${Math.random().toString(36).substring(2, 7)}`;

            // Construct the display text explicitly from filename and line number
            const displayText = `${fileName}:${lineNumber}`;
            const sanitizedDisplayText = displayText.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // Find the start index of the actual file path within the match string
            const pathStartIndexInMatch = match.lastIndexOf(fileName); // Use lastIndexOf just in case filename appears earlier
            // Get the prefix part (e.g., the space if matched by \s, or empty string if matched by ^)
            const prefixInMatch = match.substring(0, pathStartIndexInMatch);

            // Return the prefix + the link HTML
            return `${prefixInMatch}<a href="#" class="file-link" id="${linkId}" data-file-path="${escapedPath}" data-line-number="${lineNumber}">${sanitizedDisplayText}</a>`;
        });

        // 3. Handle 'raw' type specifically for its wrapper
        if (entry.type === 'raw') {
            // For raw, just wrap the (potentially linkified) message in pre
            return `<div class="log-line raw"><pre>${sanitizedMessage}</pre></div>`;
        }

        // 4. Handle other types (add timestamp and prefix)
        let prefix = '';
        switch(entry.type) {
            case 'info': prefix = '<span class="info"></span> '; break;
            case 'warn': prefix = '<span class="warn"></span> '; break;
            case 'error': prefix = '<span class="error"></span> '; break;
            case 'success': prefix = '<span class="success"></span> '; break;
            // 'log' type doesn't have a specific prefix span in the original code
        }

        let timestampStr = '';
        if (showTimestamp) {
             const ts = new Date(entry.timestamp);
             const hours = String(ts.getHours()).padStart(2, '0');
             const minutes = String(ts.getMinutes()).padStart(2, '0');
             const seconds = String(ts.getSeconds()).padStart(2, '0');
             const milliseconds = String(ts.getMilliseconds()).padStart(3, '0');
             timestampStr = `<span class="timestamp">[${hours}:${minutes}:${seconds}.${milliseconds}]</span> `;
        }

        // Return the final formatted line for non-raw types
        return `<div class="log-line ${entry.type}">${timestampStr}${prefix}${sanitizedMessage}</div>`;
    }
}

// --- Singleton Management --- 
let _outputChannel: OutputChannel | undefined;

// Update initializeOutputChannel: No longer needs context directly for OutputChannel itself
export function initializeOutputChannel(context: vscode.ExtensionContext): void {
    if (!_outputChannel) {
        _outputChannel = new OutputChannel('AutoGo'); 
        context.subscriptions.push(_outputChannel); // Still add the channel instance for disposal
    }
}

export function getOutputChannel(): OutputChannel {
    if (!_outputChannel) {
         console.error("OutputChannel not initialized. Call initializeOutputChannel first.");
         throw new Error("OutputChannel not initialized.");
    }
    return _outputChannel;
}

// Optional: Export dispose function if needed externally
// export function disposeOutputChannel(): void {
//     _outputChannel?.dispose();
//     _outputChannel = undefined;
// }