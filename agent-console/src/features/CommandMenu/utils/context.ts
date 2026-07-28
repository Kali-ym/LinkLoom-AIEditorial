import type { MenuContext } from '../types';

interface ContextConfig {
  captureSubPath?: boolean;
  matcher: RegExp;
  type: MenuContext;
}

const CONTEXT_CONFIGS: ContextConfig[] = [
  {
    matcher: /^\/agents\/console(?:\/|$|\?)/,
    type: 'agent',
  },
  {
    captureSubPath: true,
    matcher: /^\/settings(?:\/([^/]+))?/,
    type: 'settings',
  },
];

/** Admin pathname → CommandMenu 上下文*/
export function detectContext(pathname: string): MenuContext {
  for (const config of CONTEXT_CONFIGS) {
    if (config.matcher.test(pathname)) {
      return config.type;
    }
  }
  return 'general';
}

export function extractSettingsSubPath(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  const match = pathname.match(/^\/settings(?:\/([^/]+))?/);
  return match?.[1];
}
