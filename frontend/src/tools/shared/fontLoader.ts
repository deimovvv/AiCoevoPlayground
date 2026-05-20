/**
 * Brand Font Loader
 * ─────────────────
 * Dynamically loads brand fonts (headline / body / accent) from Google Fonts
 * so they're available for the Compose Mode overlay rendering.
 *
 * Strategy:
 *  - Map common font names to Google Fonts URLs
 *  - Inject a single <link> tag per font family (deduped by ID)
 *  - Return the resolved CSS font-family string for use in inline styles or canvas
 */

import type { BrandFonts } from "../../lib/api";

const FONT_LINK_PREFIX = "coevo-brand-font-";

// Known font name → Google Fonts query (with all weights/styles we'd typically use)
const GOOGLE_FONT_MAP: Record<string, string> = {
  // Editorial serifs (italic primary use case)
  "playfair display": "Playfair+Display:ital,wght@0,400..900;1,400..900",
  "playfair display italic": "Playfair+Display:ital,wght@1,400..900",
  "eb garamond": "EB+Garamond:ital,wght@0,400..800;1,400..800",
  "eb garamond italic": "EB+Garamond:ital,wght@1,400..800",
  "cormorant garamond": "Cormorant+Garamond:ital,wght@0,300..700;1,300..700",
  "instrument serif": "Instrument+Serif:ital@0;1",
  "libre caslon text": "Libre+Caslon+Text:ital,wght@0,400;0,700;1,400",

  // Modern serifs
  "dm serif display": "DM+Serif+Display:ital@0;1",
  "fraunces": "Fraunces:ital,wght@0,300..900;1,300..900",
  "spectral": "Spectral:ital,wght@0,300..800;1,300..800",

  // Sans
  "inter": "Inter:wght@100..900",
  "montserrat": "Montserrat:ital,wght@0,100..900;1,100..900",
  "poppins": "Poppins:ital,wght@0,300..900;1,300..900",
  "geist": "Geist:wght@100..900",
  "manrope": "Manrope:wght@200..800",
  "space grotesk": "Space+Grotesk:wght@300..700",
  "dm sans": "DM+Sans:ital,wght@0,100..1000;1,100..1000",
};

/**
 * Try to resolve a brand-supplied font name to a real loadable font.
 * Returns the canonical CSS font-family value.
 */
function resolveFontName(rawName: string | undefined | null, fallback: string): string {
  if (!rawName) return fallback;
  const cleaned = rawName.trim().toLowerCase().replace(/['"]/g, "");
  // Strip stylistic suffixes ("italic", "regular", weight numbers) when matching the map
  const baseName = cleaned.replace(/\s*(italic|regular|bold|light|medium|semibold|black|thin|\d+)$/i, "").trim();
  if (GOOGLE_FONT_MAP[baseName]) return baseName;
  if (GOOGLE_FONT_MAP[cleaned]) return cleaned;
  // Unknown — return as-is, will fall back to system if not loaded
  return rawName.trim();
}

function getOrCreateLink(id: string, href: string) {
  let link = document.head.querySelector(`link[id="${id}"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  } else if (link.href !== href) {
    link.href = href;
  }
}

/** Load a single font into the document via Google Fonts */
function loadGoogleFont(canonicalName: string) {
  const query = GOOGLE_FONT_MAP[canonicalName];
  if (!query) return; // not a known Google font — caller's responsibility to provide @font-face
  const id = `${FONT_LINK_PREFIX}${canonicalName.replace(/\s+/g, "-")}`;
  getOrCreateLink(id, `https://fonts.googleapis.com/css2?family=${query}&display=swap`);
}

export interface ResolvedBrandFonts {
  headline: string;
  body: string;
  accent: string;
}

/**
 * Load the brand fonts and return CSS font-family strings ready to apply.
 * Falls back to sensible defaults when brand.fonts are missing.
 */
export function loadBrandFonts(brandFonts?: BrandFonts | null): ResolvedBrandFonts {
  const headline = resolveFontName(brandFonts?.headline, "Playfair Display");
  const body = resolveFontName(brandFonts?.body, "Inter");
  const accent = resolveFontName(brandFonts?.accent, body);

  loadGoogleFont(headline);
  loadGoogleFont(body);
  if (accent !== body) loadGoogleFont(accent);

  return {
    headline: `"${headline}", Georgia, serif`,
    body: `"${body}", system-ui, -apple-system, sans-serif`,
    accent: `"${accent}", system-ui, -apple-system, sans-serif`,
  };
}

/** For Canvas 2D — strip the quotes and return the bare font name */
export function getCanvasFontFamily(cssFamily: string): string {
  const m = cssFamily.match(/"([^"]+)"/);
  return m ? m[1] : cssFamily.split(",")[0].trim();
}
