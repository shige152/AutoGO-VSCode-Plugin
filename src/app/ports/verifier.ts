export interface VerifyOptions {
  chmodExecutable?: boolean;
}

export interface Verifier {
  verifyFile(path: string, options?: VerifyOptions): Promise<void>;
}
