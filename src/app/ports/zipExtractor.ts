export interface ZipExtractOptions {
  stripPrefix?: string;
  requirePrefix?: boolean;
}

export interface ZipExtractor {
  extract(zipPath: string, targetDir: string, options?: ZipExtractOptions): Promise<void>;
}
