import { ProxyAgent } from 'undici';

import { LogService } from '../LogService.js';

/** Proxy for outbound web search/crawl; prefers settings agent, then HTTPS_PROXY/HTTP_PROXY. */
export function resolveOutboundProxyAgent(existing?: ProxyAgent): ProxyAgent | undefined {
  if (existing) return existing;

  const envProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!envProxy) return undefined;

  try {
    const agent = new ProxyAgent(envProxy);
    LogService.info(`[WebBrowsing] Using outbound proxy from env: ${envProxy}`);
    return agent;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    LogService.warn(`[WebBrowsing] Failed to initialize env proxy: ${message}`);
    return undefined;
  }
}
