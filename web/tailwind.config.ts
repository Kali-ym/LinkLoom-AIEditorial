import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx,js,jsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--ll-canvas)',
        ink: {
          DEFAULT: 'var(--ll-ink)',
          deep: 'var(--ll-ink-deep)'
        },
        charcoal: 'var(--ll-charcoal)',
        slate: 'var(--ll-slate)',
        steel: 'var(--ll-steel)',
        stone: 'var(--ll-stone)',
        body: {
          DEFAULT: 'var(--ll-body)',
          strong: 'var(--ll-body-strong)'
        },
        muted: {
          DEFAULT: 'var(--ll-muted)',
          soft: 'var(--ll-muted-soft)'
        },
        pill: {
          active: 'var(--ll-pill-active-bg)',
          'on-active': 'var(--ll-pill-active-fg)'
        },
        primary: {
          DEFAULT: 'var(--ll-primary)',
          active: 'var(--ll-primary-active)',
          disabled: 'var(--ll-hairline)'
        },
        hairline: {
          DEFAULT: 'var(--ll-hairline)',
          soft: 'var(--ll-hairline-soft)',
          strong: 'var(--ll-hairline-strong)'
        },
        surface: {
          DEFAULT: 'var(--ll-surface)',
          soft: 'var(--ll-surface-soft)',
          card: 'var(--ll-surface-card)',
          cream: 'var(--ll-surface-cream)',
          warm: 'var(--ll-surface-warm)',
          dark: '#1e293b',
          'dark-elevated': '#273449',
          'dark-soft': '#192536'
        },
        accent: {
          teal: '#14b8a6',
          amber: '#f59e0b'
        },
        score: {
          low: 'var(--ll-score-low)',
          fair: 'var(--ll-score-fair)',
          good: 'var(--ll-score-good)',
          high: 'var(--ll-score-high)',
          elite: 'var(--ll-score-elite)'
        },
        rank: {
          1: 'var(--ll-rank-1)',
          2: 'var(--ll-rank-2)',
          3: 'var(--ll-rank-3)',
          rest: 'var(--ll-rank-rest)',
          'rest-active': 'var(--ll-rank-rest-active)'
        },
        on: {
          primary: 'var(--ll-on-primary)',
          dark: 'var(--ll-ink)',
          'dark-soft': 'var(--ll-muted)'
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        mastheadLatin: ['"Playfair Display"', 'Georgia', 'serif'],
        mastheadCn: ['"Noto Serif SC"', '"Source Han Serif SC"', '"Songti SC"', 'serif']
      },
      maxWidth: {
        content: '1280px',
        prose: '720px'
      },
      boxShadow: {
        card: 'var(--ll-shadow-card)',
        subtle: 'var(--ll-shadow-subtle)'
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '16px',
        pill: '9999px'
      }
    }
  },
  plugins: []
};

export default config;
