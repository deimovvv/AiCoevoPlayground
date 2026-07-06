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

/**
 * Ejemplo pre-armado por tool (ref: Pletor te muestra el template lleno apenas entrás —
 * inputs de muestra + output — para que entiendas qué va dónde sin tocar nada).
 * Se muestra en el estado vacío del ToolRunPage. "Usar este ejemplo" precarga los inputs.
 * Sumar un ejemplo = agregar una entrada acá (+ los assets de muestra en /previews/).
 */
export interface ToolExampleInput {
  label: string;
  /** Imagen de muestra (path en /previews/). Si está, se muestra como thumb. */
  imageUrl?: string;
  /** Texto de muestra (ej. la escena/brief). */
  text?: string;
}
export interface ToolExample {
  /** Prefill del campo objective al tocar "Usar este ejemplo". */
  scene?: string;
  /** Imagen que se precarga como referenceImages[0] (ej. la UI). */
  prefillImageUrl?: string;
  inputs: ToolExampleInput[];
  outputUrl: string;
  outputType?: "image" | "video";
}

export const TOOL_EXAMPLES: Record<string, ToolExample> = {
  screen_mockup: {
    scene: "laptop en un café moderno, luz cálida de tarde, fondo desenfocado",
    prefillImageUrl: "/previews/screenmockup-ui.png",
    inputs: [
      { label: "Tu UI / pantalla", imageUrl: "/previews/screenmockup-ui.png" },
      { label: "Escena / dispositivo", text: "laptop en un café moderno, luz cálida de tarde" },
    ],
    outputUrl: "/previews/screenmockup.png",
    outputType: "image",
  },
  // Curados con el preview real que ya existe en /previews/ (output = hero de la card).
  ugc_creator: {
    inputs: [
      { label: "Avatar", text: "un avatar de tu marca hablando a cámara" },
      { label: "Guión", text: "el mensaje / hook a decir" },
    ],
    outputUrl: "/previews/ugccreator.mp4",
    outputType: "video",
  },
  video_ad_creator: {
    inputs: [
      { label: "Producto", text: "el producto a anunciar" },
      { label: "Brief", text: "dirección creativa del ad" },
    ],
    outputUrl: "/previews/videoadcreator.mp4",
    outputType: "video",
  },
  fashion_reel: {
    inputs: [
      { label: "Modelo", text: "el/la modelo del brand kit" },
      { label: "Prendas", text: "los looks a mostrar" },
    ],
    outputUrl: "/previews/agnatesttt.mp4",
    outputType: "video",
  },
  static_ad: {
    inputs: [
      { label: "Producto", text: "el producto protagonista" },
      { label: "Copy", text: "headline / mensaje del ad" },
    ],
    outputUrl: "/previews/staticad.png",
    outputType: "image",
  },
  ecommerce_pack: {
    inputs: [
      { label: "Prenda", text: "la prenda a fotografiar" },
      { label: "Modelo", text: "el/la modelo del brand kit" },
    ],
    outputUrl: "/previews/eccomerce.png",
    outputType: "image",
  },
  avatar_creator: {
    inputs: [
      { label: "Brief", text: "descripción del avatar a crear (o un avatar existente)" },
    ],
    outputUrl: "/previews/avatar.png",
    outputType: "image",
  },
};

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
