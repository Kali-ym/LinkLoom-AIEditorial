import type { Metadata } from 'next';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/600.css';
import './masthead-fonts.css';
import './globals.css';
import { SidebarNav } from '@/components/SidebarNav';
import { MobileNav } from '@/components/MobileNav';
import { FooterGate } from '@/components/FooterGate';
import { ThemeProvider } from '@/components/ThemeProvider';
import { FaviconSync } from '@/components/FaviconSync';

export const metadata: Metadata = {
  title: {
    default: 'LinkLoom · 行业热搜',
    template: '%s · LinkLoom'
  },
  description: 'AI 从业者的行业热搜与可筛选信息流。',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' }
    ],
    shortcut: '/icon.svg',
    apple: '/apple-icon.svg'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="bg-canvas text-body flex flex-col h-dvh overflow-hidden">
        <ThemeProvider>
          <FaviconSync />
          <MobileNav />
          <div className="flex flex-1 min-h-0 w-full overflow-hidden">
            <SidebarNav />
            <div className="relative flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(47,111,126,0.06),transparent_26rem)] dark:bg-[radial-gradient(circle_at_82%_8%,rgba(95,168,181,0.05),transparent_26rem)]" />
              <main
                data-reader-scroll
                className="relative flex-1 min-h-0 overflow-y-auto w-full"
              >
                {children}
              </main>
              <FooterGate />
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
