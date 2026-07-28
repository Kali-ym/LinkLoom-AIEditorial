import { useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

function upsertIconLink(rel: string, href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-theme-icon]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    link.setAttribute('data-theme-icon', 'true');
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = href;
}

export default function FaviconSync() {
  const { theme } = useTheme();
  const icons = useMemo(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    return {
      light: `${base}/icon.svg`,
      dark: `${base}/icon-dark.svg`
    };
  }, []);

  useEffect(() => {
    const href = theme === 'dark' ? icons.dark : icons.light;
    upsertIconLink('icon', href);
    upsertIconLink('shortcut icon', href);
  }, [theme, icons]);

  return null;
}
