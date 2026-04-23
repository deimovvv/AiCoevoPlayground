import { useEffect, useState, useCallback } from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "coevo-theme";
const DEFAULT: Theme = "dark";

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return DEFAULT;
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
}

/** Applies the stored theme on first load — call once from app root. */
export function initTheme() {
  apply(readStored());
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => readStored());

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);

  return { theme, setTheme, toggle };
}
