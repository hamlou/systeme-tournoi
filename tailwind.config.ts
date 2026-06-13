import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./styles/**/*.css",
  ],
  theme: {
    extend: {
      /* ── Font Families ─────────────────────────────────────── */
      fontFamily: {
        display: ["var(--font-bebas)", "Impact", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },

      /* ── Color Palette ─────────────────────────────────────── */
      colors: {
        /* Background layers */
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "bg-card": "var(--bg-card)",
        "bg-elevated": "var(--bg-elevated)",

        /* IKF Brand */
        "ikf-red": "var(--ikf-red)",
        "ikf-gold": "var(--ikf-gold)",

        /* Corner colors */
        "corner-red": "var(--corner-red)",
        "corner-blue": "var(--corner-blue)",

        /* Text */
        "text-base": "var(--text-primary)",
        "text-sub": "var(--text-secondary)",
        "text-dim": "var(--text-muted)",

        /* Status */
        "status-win": "var(--status-win)",
        "status-loss": "var(--status-loss)",
        "status-draw": "var(--status-draw)",
        "status-live": "var(--status-live)",

        /* shadcn/ui compatibility */
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        card: {
          DEFAULT: "var(--bg-card)",
          foreground: "var(--text-primary)",
        },
        primary: {
          DEFAULT: "var(--ikf-red)",
          foreground: "var(--text-primary)",
        },
        secondary: {
          DEFAULT: "var(--bg-elevated)",
          foreground: "var(--text-secondary)",
        },
        muted: {
          DEFAULT: "var(--bg-secondary)",
          foreground: "var(--text-muted)",
        },
        border: "var(--border-default)",
        input: "var(--bg-elevated)",
        ring: "var(--ikf-red)",
      },

      /* ── Border Radius ─────────────────────────────────────── */
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "24px",
        "3xl": "32px",
      },

      /* ── Box Shadows ───────────────────────────────────────── */
      boxShadow: {
        card: "var(--shadow-card)",
        "red-glow": "var(--shadow-red-glow)",
        "gold-glow": "var(--shadow-gold-glow)",
        "blue-glow": "var(--shadow-blue-glow)",
        "inner-top": "inset 0 1px 0 rgba(255,255,255,0.06)",
      },

      /* ── Animations ────────────────────────────────────────── */
      keyframes: {
        "pulse-live": {
          "0%, 100%": {
            opacity: "1",
            boxShadow: "0 0 0 0 rgba(255, 68, 68, 0.7)",
          },
          "50%": {
            opacity: "0.7",
            boxShadow: "0 0 0 6px rgba(255, 68, 68, 0)",
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "number-tick": {
          from: { transform: "translateY(4px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        scan: {
          "0%, 100%": { top: "0%" },
          "50%": { top: "100%" },
        },
      },
      animation: {
        "pulse-live": "pulse-live 2s ease-in-out infinite",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "slide-up": "slide-up 0.3s ease-out",
        "fade-in": "fade-in 0.25s ease-out",
        "number-tick": "number-tick 0.4s ease-out",
        scan: "scan 2s ease-in-out infinite",
      },

      /* ── Spacing ───────────────────────────────────────────── */
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "88": "22rem",
        "100": "25rem",
        "112": "28rem",
        "128": "32rem",
      },

      /* ── Z-index ───────────────────────────────────────────── */
      zIndex: {
        "60": "60",
        "70": "70",
        "80": "80",
        "90": "90",
        "100": "100",
      },

      /* ── Backdrop Blur ─────────────────────────────────────── */
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
