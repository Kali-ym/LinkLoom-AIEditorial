export type AdminUiLang = 'zh' | 'en';

const STORAGE_KEY = 'admin-ui-lang';

/** 优先读 localStorage（admin-ui-lang = zh|en），否则按浏览器语言推断。 */
export function getAdminUiLang(): AdminUiLang {
  if (typeof window === 'undefined') return 'zh';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'zh') return stored;
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}
