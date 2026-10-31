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

// Paleta «sistema» (la de la web, coevo-web /sistema): es la de siempre desde el 2026-10-31.
// ?paleta=papel vuelve a la anterior y queda guardado; ?paleta=sistema la restituye. Sólo el tema claro.
const PALETA_KEY = "coevo-paleta";

function applyPaleta() {
  let paleta: string | null = null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("paleta");
    if (fromUrl === "papel") localStorage.setItem(PALETA_KEY, "papel");
    else if (fromUrl === "sistema") localStorage.removeItem(PALETA_KEY);
    paleta = localStorage.getItem(PALETA_KEY);
  } catch {}
  if (paleta !== "papel") document.documentElement.setAttribute("data-paleta", "sistema");
  else document.documentElement.removeAttribute("data-paleta");
}

/** Applies the stored theme on first load — call once from app root. */
export function initTheme() {
  apply(readStored());
  applyPaleta();
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
