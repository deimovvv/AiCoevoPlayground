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
      { label: "Brief / guión", text: "pegá el brief o el guión escena por escena" },
      { label: "Personaje", text: "opcional — o una referencia; la IA lo propone" },
      { label: "Estilo", text: "Playmobil, tejido, claymation, foto real…" },
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
  // Videos reales de corridas nuestras.
  video_ad_creator: { url: "/previews/videoadcreator.mp4", type: "video" },
  ugc_creator: { url: "/previews/ugccreator.mp4", type: "video" },
  fashion_reel: { url: "/previews/agnatesttt.mp4", type: "video" },

  // Piezas generadas — registro flash directo / 35mm / color saturado (2026-09-20).
  // Antes estos slots tenían CAPTURAS DE LA UI de 40-50 KB ("placeholders branded"),
  // que hacían que el catálogo se viera pobre: una tool de generación visual no puede
  // mostrar un pantallazo de sí misma como ejemplo de lo que produce.
  fashion_editorial: { url: "/hero/flash-portrait.webp", type: "image" },
  avatar_creator: { url: "/hero/flash-blue-track.webp", type: "image" },
  product_spotlight: { url: "/hero/flash-red-sky.webp", type: "image" },
  carousel_creator: { url: "/hero/flash-two-wall.webp", type: "image" },

  // Piezas del set editorial anterior — sirven donde el sujeto es producto o prenda.
  ecommerce_pack: { url: "/hero/standing-pair.webp", type: "image" },
  ecommerce_batch: { url: "/hero/coat-front.webp", type: "image" },
  product_sheet: { url: "/hero/boots-pair.webp", type: "image" },
  product_clip: { url: "/hero/garment-hanger.webp", type: "image" },
  scene_reconstruct: { url: "/hero/seated-chair.webp", type: "image" },
  video_swap: { url: "/hero/back-turn.webp", type: "image" },
  content_analyzer: { url: "/hero/crouch.webp", type: "image" },
  fooh_subway: { url: "/hero/product-table.webp", type: "image" },
  ad_creative_lab: { url: "/hero/seated-floor.webp", type: "image" },
  static_ad: { url: "/previews/staticad.png", type: "image" },

  // Mockup de UI: acá SÍ corresponde una captura, porque eso es lo que la tool produce.
  screen_mockup: { url: "/previews/screenmockup.png", type: "image" },
};
