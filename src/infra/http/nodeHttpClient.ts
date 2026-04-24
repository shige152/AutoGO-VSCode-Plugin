import * as https from 'https';
import { HttpClient } from '../../app/ports/httpClient';

export class NodeHttpClient implements HttpClient {
  async getText(url: string, options: { timeoutMs?: number } = {}): Promise<string> {
    const timeoutMs = options.timeoutMs ?? 10000;
    return this.getTextInternal(url, timeoutMs, 0);
  }

  private async getTextInternal(url: string, timeoutMs: number, redirectCount: number): Promise<string> {
    if (redirectCount > 5) {
      throw new Error(`Too many redirects: ${url}`);
    }

    return new Promise<string>((resolve, reject) => {
      const request = https.get(url, (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          resolve(this.getTextInternal(response.headers.location, timeoutMs, redirectCount + 1));
          return;
        }

        if (status !== 200) {
          response.resume();
          reject(new Error(`Request failed: ${status}`));
          return;
        }

        response.setEncoding('utf8');
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          resolve(data);
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
      });
    });
  }
}
