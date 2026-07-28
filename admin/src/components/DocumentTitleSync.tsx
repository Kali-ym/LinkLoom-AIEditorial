import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { adminDocumentTitle } from '../config/adminBrand';
import { getAdminUiLang } from '../utils/adminUiLocale';

/** 按语言同步 document.title 与 html lang（与 index.html 首屏一致）。 */
export default function DocumentTitleSync() {
  const location = useLocation();

  useEffect(() => {
    const lang = getAdminUiLang();
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = adminDocumentTitle(lang);
  }, [location.pathname]);

  return null;
}
