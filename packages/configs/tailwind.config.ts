import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["../../packages/ui-core/src/**/*.{ts,tsx}", "../../apps/*/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dbe4ff",
          200: "#bac8ff",
          300: "#91a7ff",
          400: "#748ffc",
          500: "#5c7cfa",
          600: "#4c6ef5",
          700: "#4263eb",
          800: "#3b5bdb",
          900: "#364fc7",
        },
        surface: {
          DEFAULT: "#ffffff",
          secondary: "#f8f9fa",
          tertiary: "#f1f3f5",
          dark: "#1a1b1e",
          "dark-secondary": "#25262b",
          "dark-tertiary": "#2c2e33",
        },
        border: {
          DEFAULT: "#dee2e6",
          dark: "#373a40",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "slide-in-left": "slideInLeft 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
