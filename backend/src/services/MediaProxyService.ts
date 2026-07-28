import { lookup } from 'dns/promises';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import type { ProxyAgent } from 'undici';
import { LogService } from './LogService.js';

export interface MediaProxyResult {
  buffer?: Buffer;
  contentType?: string;
  redirectUrl?: string;
  statusCode?: number;
  error?: string;
}

export class MediaProxyService {
  constructor(private readonly proxyAgent?: ProxyAgent) {}

  async readTempImage(filePath: string): Promise<MediaProxyResult> {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      try {
        const response = await this.safeFetch(filePath);
        if (response.ok) {
          const contentType = this.assertImageResponse(response);
          const buffer = Buffer.from(await response.arrayBuffer());
          return { buffer, contentType };
        }
      } catch (e: any) {
        LogService.warn(
          `Proxy fetch failed for ${filePath}, falling back to redirect: ${e.message}`
        );
      }
      return { redirectUrl: filePath };
    }

    const resolvedPath = path.resolve(filePath);
    const tempDir = os.tmpdir();

    if (!resolvedPath.startsWith(tempDir)) {
      return { statusCode: 403, error: 'Forbidden: Can only access temp files' };
    }

    if (!fs.existsSync(resolvedPath)) {
      return { statusCode: 404, error: 'File not found' };
    }

    return {
      buffer: fs.readFileSync(resolvedPath),
      contentType: 'image/jpeg'
    };
  }

  async fetchImage(url: string): Promise<MediaProxyResult> {
    const response = await this.safeFetch(url);
    if (!response.ok) {
      return {
        statusCode: response.status,
        error: `Failed to fetch image: ${response.statusText}`
      };
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: this.assertImageResponse(response)
    };
  }

  private async safeFetch(rawUrl: string): Promise<Response> {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Only http(s) URLs are allowed');
    }

    await this.assertPublicHostname(url.hostname);

    const controller = new AbortController();
    const timeoutMs = Number(process.env.MEDIA_PROXY_TIMEOUT_MS || 10_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: 'GET',
        dispatcher: this.proxyAgent,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async assertPublicHostname(hostname: string): Promise<void> {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length) {
      throw new Error('Unable to resolve media host');
    }
    for (const address of addresses) {
      if (this.isPrivateAddress(address.address)) {
        throw new Error(`Blocked private media host address: ${address.address}`);
      }
    }
  }

  private isPrivateAddress(address: string): boolean {
    if (address === '127.0.0.1' || address === '::1' || address === '0.0.0.0') return true;
    if (address.startsWith('169.254.') || address.startsWith('10.')) return true;
    if (address.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) return true;
    if (address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:'))
      return true;
    return net.isIP(address) === 0;
  }

  private assertImageResponse(response: Response): string | undefined {
    const contentType = response.headers.get('content-type') || undefined;
    if (contentType && !contentType.toLowerCase().startsWith('image/')) {
      throw new Error(`Unsupported media content-type: ${contentType}`);
    }
    const length = Number(response.headers.get('content-length') || 0);
    const maxBytes = Number(process.env.MEDIA_PROXY_MAX_BYTES || 10 * 1024 * 1024);
    if (length > maxBytes) {
      throw new Error(`Media response is too large: ${length} bytes`);
    }
    return contentType;
  }
}
