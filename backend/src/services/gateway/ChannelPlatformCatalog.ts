import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface ChannelPlatformCredentialField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
}

export interface ChannelPlatformDefinition {
  id: string;
  name: string;
  description?: string;
  comingSoon?: boolean;
  documentationUrl?: string;
  credentialFields?: ChannelPlatformCredentialField[];
}

interface ChannelPlatformsSeed {
  platforms: ChannelPlatformDefinition[];
}

let cachedPlatforms: ChannelPlatformDefinition[] | null = null;
let cachedPath: string | null = null;

function resolveSeedPath(projectRoot: string): string {
  return path.join(projectRoot, 'infra', 'seeds', 'channel-platforms.json');
}

function parseSeed(raw: string): ChannelPlatformDefinition[] {
  const parsed = JSON.parse(raw) as ChannelPlatformsSeed | ChannelPlatformDefinition[];
  const platforms = Array.isArray(parsed) ? parsed : parsed.platforms;
  if (!Array.isArray(platforms)) {
    throw new Error('channel-platforms.json must contain a platforms array');
  }
  return platforms.map((platform) => ({ ...platform }));
}

export function loadChannelPlatforms(projectRoot: string): ChannelPlatformDefinition[] {
  const seedPath = resolveSeedPath(projectRoot);
  if (cachedPlatforms && cachedPath === seedPath) {
    return cachedPlatforms.map((platform) => ({ ...platform }));
  }

  const raw = readFileSync(seedPath, 'utf-8');
  const platforms = parseSeed(raw);
  cachedPlatforms = platforms;
  cachedPath = seedPath;
  return platforms.map((platform) => ({ ...platform }));
}
