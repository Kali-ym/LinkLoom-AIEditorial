/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // LinkLoom brand accent (preserved)
        "primary": "#0cafcf",
        "primary-deep": "#0892ac",

        // Miro-inspired Ink (dominant CTA color)
        "ink": "#0a0a12",
        "ink-deep": "#050038",
        "charcoal": "#2c2a3a",

        // Surface system
        "canvas": "#ffffff",
        "surface": "#f5f5f7",
        "surface-soft": "#fafafb",
        "surface-yellow": "#fff8d6",
        "surface-lavender": "#efedff",

        // Hairline borders
        "hairline": "#e4e5e9",
        "hairline-soft": "#eeeef1",
        "hairline-strong": "#c5c6cc",

        // Text scale
        "text-ink": "#1f1b36",
        "text-charcoal": "#3b3850",
        "text-slate": "#6a6680",
        "text-steel": "#85819a",
        "text-stone": "#a8a4bc",
        "text-muted": "#c5c2d0",

        // Brand-yellow (signature Miro accent, used for highlights/badges)
        "brand-yellow": "#fcdc2a",
        "brand-yellow-deep": "#e5c800",
        "yellow-light": "#fff6cc",
        "yellow-dark": "#5a4e00",

        // Pastel feature cards
        "brand-coral": "#ff7a59",
        "coral-light": "#ffe2d6",
        "coral-dark": "#7a1f0f",
        "brand-rose": "#ffd5d8",
        "rose-light": "#ffe9eb",
        "brand-teal": "#1aa499",
        "teal-light": "#d1f5f0",
        "moss-dark": "#0f4f4a",
        "brand-orange-light": "#ffd9b3",

        // Legacy / dark mode tokens (preserved for backward compatibility)
        "background-light": "#f7f7f9",
        "background-dark": "#0c1015",
        "surface-dark": "#161a23",
        "surface-dark-lighter": "#1f2530",
        "surface-darker": "#0a0d12",
        "border-dark": "#2a3040",
        "text-secondary": "#90c1cb",

        // Semantic
        "accent-success": "#0bb07b",
        "accent-warning": "#f7b500",
        "accent-error": "#ef4444",
        "brand-red": "#ff5c5c",
      },
      fontFamily: {
        "display": ["Inter", "Noto Sans SC", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        "body": ["Inter", "Noto Sans SC", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      fontSize: {
        // Miro-inspired typography scale
        "hero": ["80px", { lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "500" }],
        "display-lg": ["60px", { lineHeight: "1.10", letterSpacing: "-0.02em", fontWeight: "500" }],
        "heading-1": ["48px", { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "500" }],
        "heading-2": ["36px", { lineHeight: "1.20", letterSpacing: "-0.01em", fontWeight: "500" }],
        "heading-3": ["28px", { lineHeight: "1.25", fontWeight: "500" }],
        "heading-4": ["22px", { lineHeight: "1.30", fontWeight: "500" }],
        "stat": ["64px", { lineHeight: "1.10", letterSpacing: "-0.02em", fontWeight: "500" }],
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.75rem",     // 28px pastel cards
        "feature": "2rem",    // 32px hero/CTA banners
        "full": "9999px"
      },
      boxShadow: {
        "subtle": "rgba(5, 0, 56, 0.04) 0px 1px 2px 0px",
        "card": "rgba(5, 0, 56, 0.06) 0px 4px 12px 0px",
        "mockup": "rgba(5, 0, 56, 0.08) 0px 12px 32px -4px",
        "modal": "rgba(5, 0, 56, 0.12) 0px 16px 48px -8px",
      },
      animation: {
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
