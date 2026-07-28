/**
 * Console 本地配置缓存（精简版）：仅保留主题所需 loadConfig/saveConfig。
 * 不含 admin 页面级日期缓存（SELECTION/GENERATION/WORKFLOW 等）。
 */
import { devLogger } from './devLogger';

const CACHE_PREFIX = 'ai_insight_daily_';

export const CACHE_KEYS = {
  THEME: 'theme'
} as const;

/**
 * 保存配置到 localStorage（不需要日期和过期时间）
 */
export function saveConfig<T>(key: string, value: T): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch (error) {
    devLogger.error('保存配置失败:', error);
  }
}

/**
 * 从 localStorage 读取配置
 */
export function loadConfig<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (error) {
    devLogger.error('读取配置失败:', error);
    return null;
  }
}
