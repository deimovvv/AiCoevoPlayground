/**
 * Compose Mode — Overlay Templates
 * ──────────────────────────────────
 * Dynamic templates that compose text overlays on top of clean AI-generated images.
 * Each template defines a layout that adapts to:
 *  - The brand's typography (headline + body fonts via brand.fonts)
 *  - The brand's colors (accents from brand.designSystem)
 *  - The aspect ratio (4:5 / 9:16 / 1:1 / 16:9)
 *  - The actual content length (auto-sizing)
 *
 * Templates are pure data (no React) — rendering happens in <ComposeOverlay/> and exportComposed().
 */

export type OverlayPosition = "top-left" | "top-center" | "top-right" | "center" | "bottom-left" | "bottom-center" | "bottom-right";

export interface OverlaySlot {
  /** Field key — maps to slide.headline / slide.body / slide.cta / slide.eyebrow */
  field: "eyebrow" | "headline" | "subline" | "cta";
  /** Position anchor */
  position: OverlayPosition;
  /** Font family token to use — "headline" | "body" | "accent" */
  fontFamilyToken: "headline" | "body" | "accent";
  /** Relative font size (% of canvas height) */
  fontSizePct: number;
  /** Font weight 100-900 */
  fontWeight: number;
  /** italic? */
  italic: boolean;
  /** Letter-spacing in em */
  trackingEm: number;
  /** Line-height multiplier */
  lineHeight: number;
  /** Uppercase? */
  uppercase: boolean;
  /** Max width as % of canvas width */
  maxWidthPct: number;
  /** Text-align */
  align: "left" | "center" | "right";
  /** Color token: "fg" (auto-contrast against image) | "warm" | "action" | "calm" | hex */
  color: string;
  /** Margin from the edge in % of canvas */
  marginPct: number;
}

export interface OverlayTemplate {
  id: string;
  name: string;
  description: string;
  /** Aspect ratios this template was designed for. If empty, works for all. */
  aspectRatios?: string[];
  slots: OverlaySlot[];
  /** Optional dark scrim behind text for legibility (alpha 0-1) */
  scrim?: { position: "top" | "bottom" | "full" | "center"; alpha: number; heightPct: number };
}

export const OVERLAY_TEMPLATES: OverlayTemplate[] = [
  {
    id: "editorial_bottom",
    name: "Editorial Bottom",
    description: "Eyebrow uppercase top-left + headline serif italic bottom-left. Editorial fashion magazine feel.",
    slots: [
      {
        field: "eyebrow",
        position: "top-left",
        fontFamilyToken: "body",
        fontSizePct: 1.4,
        fontWeight: 500,
        italic: false,
        trackingEm: 0.25,
        lineHeight: 1.2,
        uppercase: true,
        maxWidthPct: 50,
        align: "left",
        color: "fg",
        marginPct: 5,
      },
      {
        field: "headline",
        position: "bottom-left",
        fontFamilyToken: "headline",
        fontSizePct: 7,
        fontWeight: 400,
        italic: true,
        trackingEm: -0.02,
        lineHeight: 0.95,
        uppercase: false,
        maxWidthPct: 70,
        align: "left",
        color: "fg",
        marginPct: 5,
      },
    ],
  },
  {
    id: "center_quote",
    name: "Center Quote",
    description: "Pull-quote serif italic centered over a darkened image. Editorial standalone.",
    scrim: { position: "full", alpha: 0.45, heightPct: 100 },
    slots: [
      {
        field: "headline",
        position: "center",
        fontFamilyToken: "headline",
        fontSizePct: 6,
        fontWeight: 400,
        italic: true,
        trackingEm: -0.015,
        lineHeight: 1.05,
        uppercase: false,
        maxWidthPct: 80,
        align: "center",
        color: "#ffffff",
        marginPct: 8,
      },
    ],
  },
  {
    id: "top_tag_big_headline",
    name: "Top Tag + Big Headline",
    description: "Eyebrow uppercase top + display headline below. Hero slide format.",
    slots: [
      {
        field: "eyebrow",
        position: "top-left",
        fontFamilyToken: "body",
        fontSizePct: 1.4,
        fontWeight: 600,
        italic: false,
        trackingEm: 0.3,
        lineHeight: 1.2,
        uppercase: true,
        maxWidthPct: 60,
        align: "left",
        color: "fg",
        marginPct: 6,
      },
      {
        field: "headline",
        position: "bottom-left",
        fontFamilyToken: "headline",
        fontSizePct: 8.5,
        fontWeight: 400,
        italic: true,
        trackingEm: -0.025,
        lineHeight: 0.92,
        uppercase: false,
        maxWidthPct: 80,
        align: "left",
        color: "fg",
        marginPct: 6,
      },
      {
        field: "subline",
        position: "bottom-left",
        fontFamilyToken: "body",
        fontSizePct: 1.6,
        fontWeight: 400,
        italic: false,
        trackingEm: 0,
        lineHeight: 1.4,
        uppercase: false,
        maxWidthPct: 60,
        align: "left",
        color: "fg",
        marginPct: 6,
      },
    ],
  },
  {
    id: "minimal_caption",
    name: "Minimal Caption",
    description: "Solo una línea de copy abajo, imagen full-bleed. Restraint editorial puro.",
    slots: [
      {
        field: "headline",
        position: "bottom-center",
        fontFamilyToken: "headline",
        fontSizePct: 3,
        fontWeight: 400,
        italic: true,
        trackingEm: -0.01,
        lineHeight: 1.2,
        uppercase: false,
        maxWidthPct: 70,
        align: "center",
        color: "fg",
        marginPct: 5,
      },
    ],
  },
  {
    id: "card_overlay",
    name: "Card Overlay",
    description: "Card blanca o negra con todo el copy, imagen como background.",
    slots: [
      {
        field: "eyebrow",
        position: "bottom-left",
        fontFamilyToken: "body",
        fontSizePct: 1.2,
        fontWeight: 600,
        italic: false,
        trackingEm: 0.2,
        lineHeight: 1.2,
        uppercase: true,
        maxWidthPct: 80,
        align: "left",
        color: "fg",
        marginPct: 6,
      },
      {
        field: "headline",
        position: "bottom-left",
        fontFamilyToken: "headline",
        fontSizePct: 4.5,
        fontWeight: 400,
        italic: true,
        trackingEm: -0.015,
        lineHeight: 1.0,
        uppercase: false,
        maxWidthPct: 80,
        align: "left",
        color: "fg",
        marginPct: 6,
      },
      {
        field: "subline",
        position: "bottom-left",
        fontFamilyToken: "body",
        fontSizePct: 1.4,
        fontWeight: 400,
        italic: false,
        trackingEm: 0,
        lineHeight: 1.4,
        uppercase: false,
        maxWidthPct: 80,
        align: "left",
        color: "fg",
        marginPct: 6,
      },
    ],
    scrim: { position: "bottom", alpha: 0.55, heightPct: 50 },
  },
  {
    id: "clean_image",
    name: "Clean Image",
    description: "Sin texto. Solo la imagen full-bleed para slides puramente visuales.",
    slots: [],
  },
];

export function getTemplate(id: string): OverlayTemplate {
  return OVERLAY_TEMPLATES.find((t) => t.id === id) || OVERLAY_TEMPLATES[0];
}
