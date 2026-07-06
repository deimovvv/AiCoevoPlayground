/**
 * Tool preview media — el "hero de ejemplo" por tool (ref: cada template de Pletor
 * muestra un output de ejemplo en su card + panel de detalle).
 * ─────────────────────────────────────────────────────────────────────────────
 * Camino A (curado): una imagen/video fijo por tool, servido desde /public/previews/.
 * Se usa en la card de Generar (GeneratePage) y en el modal "¿Cómo funciona?" (ToolHelp).
 * Sumar un ejemplo = dropear el archivo en public/previews/ + agregar una línea acá.
 * Si un tool no tiene entrada, la UI cae al gradiente/ícono (fallback elegante).
 */

export interface ToolPreview {
  url: string;
  type: "image" | "video";
}

export const TOOL_PREVIEW_MEDIA: Record<string, ToolPreview> = {
  video_ad_creator: { url: "/previews/videoadcreator.mp4", type: "video" },
  ugc_creator: { url: "/previews/ugccreator.mp4", type: "video" },
  fashion_reel: { url: "/previews/agnatesttt.mp4", type: "video" },
  static_ad: { url: "/previews/staticad.png", type: "image" },
  ecommerce_pack: { url: "/previews/eccomerce.png", type: "image" },
  avatar_creator: { url: "/previews/avatar.png", type: "image" },
  // Dropeá un mockup que te guste en public/previews/screenmockup.png y se enciende el hero.
  screen_mockup: { url: "/previews/screenmockup.png", type: "image" },
};
