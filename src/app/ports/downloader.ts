export interface DownloadProgress {
  transferredBytes: number;
  totalBytes?: number;
}

export interface DownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
}

export interface Downloader {
  download(url: string, destinationPath: string, options?: DownloadOptions): Promise<void>;
}
