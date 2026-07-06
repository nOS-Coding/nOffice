import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("noffice-theme") as Theme) ?? "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme(t: Theme) {
      const isDark = t === "dark" || (t === "system" && mediaQuery.matches);
      root.classList.toggle("dark", isDark);
    }

    applyTheme(theme);

    function handleChange() {
      if (theme === "system") applyTheme("system");
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("noffice-theme", t);
  }

  return { theme, setTheme };
}
