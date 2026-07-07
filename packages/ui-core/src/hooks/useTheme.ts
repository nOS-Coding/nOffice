import { useEffect, useState } from "react";

import type { ThemeOption } from "@noffice/shared";

const THEME_COLORS: Record<string, { bg: string; text: string; surface: string }> = {
  light: { bg: "#ffffff", text: "#000000", surface: "#f8f9fa" },
  dark: { bg: "#1a1b1e", text: "#ffffff", surface: "#25262b" },
  sepia: { bg: "#fbf0d9", text: "#433422", surface: "#f5e6c8" },
  forest: { bg: "#1a2e1a", text: "#d4e8d4", surface: "#243824" },
  ocean: { bg: "#0d1b2a", text: "#e0e7ff", surface: "#1b2d45" },
  midnight: { bg: "#0a0a12", text: "#c8c8d0", surface: "#14141e" },
  solarized: { bg: "#fdf6e3", text: "#657b83", surface: "#eee8d5" },
};

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeOption>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("noffice-theme") as ThemeOption) ?? "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme(t: ThemeOption) {
      root.classList.remove("light", "dark", "sepia", "forest", "ocean", "midnight", "solarized");
      if (t === "system") {
        const isDark = mediaQuery.matches;
        root.classList.add(isDark ? "dark" : "light");
        root.style.colorScheme = isDark ? "dark" : "light";
      } else {
        root.classList.add(t);
        const isDark = t === "dark" || t === "midnight" || t === "forest" || t === "ocean";
        root.style.colorScheme = isDark ? "dark" : "light";
      }
      const colors = THEME_COLORS[t === "system" ? (mediaQuery.matches ? "dark" : "light") : t];
      if (colors) {
        root.style.setProperty("--theme-bg", colors.bg);
        root.style.setProperty("--theme-text", colors.text);
        root.style.setProperty("--theme-surface", colors.surface);
      }
    }

    applyTheme(theme);

    function handleChange() {
      if (theme === "system") applyTheme("system");
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  function setTheme(t: ThemeOption) {
    setThemeState(t);
    localStorage.setItem("noffice-theme", t);
  }

  return { theme, setTheme };
}
