import { createContext, type PropsWithChildren } from 'react';

import { zhCN, type AgentConsoleLocale } from './locales/zh-CN';

type LocaleMessages = AgentConsoleLocale;

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

let activeLocale: LocaleMessages = zhCN;

export function t(key: string, params?: Record<string, string | number>): string {
  const raw = getNestedValue(activeLocale as unknown as Record<string, unknown>, key);
  if (!raw) return key;
  return interpolate(raw, params);
}

const LocaleContext = createContext<LocaleMessages>(zhCN);

export function AgentConsoleLocaleProvider({ children }: PropsWithChildren) {
  activeLocale = zhCN;
  return <LocaleContext value={zhCN}>{children}</LocaleContext>;
}
