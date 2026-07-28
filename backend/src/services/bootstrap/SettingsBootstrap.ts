import { ProxyAgent } from 'undici';
import type { SystemSettings } from '../../types/config.js';
import { createAIProvider, type AIProvider } from '../AIProvider.js';
import { ConfigService } from '../ConfigService.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';

export interface SettingsBootstrapResult {
  configService: ConfigService;
  settings: SystemSettings;
  proxyAgent?: ProxyAgent;
  aiProvider?: AIProvider;
}

export async function bootstrapSettings(store: LocalStore): Promise<SettingsBootstrapResult> {
  const configService = await ConfigService.getInstance(store);
  const settings = configService.getSettings();
  const proxyAgent = initProxyAgent(settings);
  const aiProvider = initAIProvider(settings, proxyAgent);

  return { configService, settings, proxyAgent, aiProvider };
}

function initProxyAgent(settings: SystemSettings): ProxyAgent | undefined {
  const proxyUrl = settings.API_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!proxyUrl) return undefined;

  try {
    const agent = new ProxyAgent(proxyUrl);
    LogService.info(`Proxy agent initialized with: ${proxyUrl}`);
    return agent;
  } catch (error: any) {
    LogService.error(`Failed to initialize proxy agent: ${error?.message || error}`);
  }
  return undefined;
}

function initAIProvider(settings: SystemSettings, proxyAgent?: ProxyAgent): AIProvider | undefined {
  const providers = settings.AI_PROVIDERS || [];
  const activeProviderConfig = providers.find(
    (provider: any) => provider.id === settings.ACTIVE_AI_PROVIDER_ID
  );
  if (!activeProviderConfig) return undefined;

  const dispatcher = activeProviderConfig.useProxy === true ? proxyAgent : undefined;
  return createAIProvider(activeProviderConfig, dispatcher) || undefined;
}
