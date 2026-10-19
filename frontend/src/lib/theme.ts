import { useEffect, useState, useCallback } from "react";

export type Theme = "dark" | "light";
// v2: studio-v2 cambia el tema por defecto a claro (papel). La clave nueva hace que todos
// arranquen en claro una vez; después cada uno elige.
const STORAGE_KEY = "coevo-theme-v2";
const DEFAULT: Theme = "light";

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
