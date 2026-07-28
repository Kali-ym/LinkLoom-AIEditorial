import type { ReasoningEffort } from '../../../domain/types';

export type ParamKey = 'temperature' | 'top_p' | 'presence_penalty' | 'frequency_penalty';

export const ADVANCED_OPEN_STORAGE_KEY = 'linkloom-agent-console-params-advanced-open';
export const MODEL_CONFIG_OPEN_STORAGE_KEY = 'linkloom-agent-console-params-model-config-open';

export const PARAM_DEFAULTS: Record<ParamKey, number> = {
  frequency_penalty: 0,
  presence_penalty: 0,
  temperature: 0.7,
  top_p: 1,
};

export const PARAM_ORDER: ParamKey[] = [
  'temperature',
  'top_p',
  'frequency_penalty',
  'presence_penalty',
];

export const PARAM_SLIDER_CONFIG: Record<
  ParamKey,
  { max: number; min: number; step: number; tag: string }
> = {
  frequency_penalty: { max: 2, min: -2, step: 0.1, tag: 'frequency_penalty' },
  presence_penalty: { max: 2, min: -2, step: 0.1, tag: 'presence_penalty' },
  temperature: { max: 2, min: 0, step: 0.1, tag: 'temperature' },
  top_p: { max: 1, min: 0, step: 0.1, tag: 'top_p' },
};

export const CONSOLE_REASONING_EFFORT_OPTIONS: Array<{
  label: string;
  value: ReasoningEffort;
}> = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Xhigh', value: 'xhigh' },
  { label: 'Max', value: 'max' },
];

export function getStoredSectionOpen(storageKey: string, defaultOpen = false): boolean {
  if (typeof window === 'undefined') return defaultOpen;
  const raw = window.localStorage.getItem(storageKey);
  if (raw === null) return defaultOpen;
  return raw === 'true';
}

export function setStoredSectionOpen(storageKey: string, open: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, String(open));
}
