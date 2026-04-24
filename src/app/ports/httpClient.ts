export interface HttpClient {
  getText(url: string, options?: { timeoutMs?: number }): Promise<string>;
}
