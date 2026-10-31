import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--color-brand)",
          hover: "var(--color-brand-hover)",
          active: "var(--color-brand-active)",
          subtle: "var(--color-brand-subtle)",
          text: "var(--color-brand-text)",
        },
        bg: {
          base: "var(--color-bg-base)",
          canvas: "var(--color-bg-canvas)",
          subtle: "var(--color-bg-subtle)",
          raised: "var(--color-bg-raised)",
          sidebar: "var(--color-bg-sidebar)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          disabled: "var(--color-text-disabled)",
          inverse: "var(--color-text-inverse)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
          brand: "var(--color-border-brand)",
        },
        semantic: {
          success: "var(--color-success)",
          "success-subtle": "var(--color-success-subtle)",
          warning: "var(--color-warning)",
          "warning-subtle": "var(--color-warning-subtle)",
          danger: "var(--color-error)",
          "danger-subtle": "var(--color-error-subtle)",
          info: "var(--color-info)",
          "info-subtle": "var(--color-info-subtle)",
        },
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};

export default config;
