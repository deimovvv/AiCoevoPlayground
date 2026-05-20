# Coevo — Design Language

Sistema visual de Coevo Studio. **Regla de oro**: el lenguaje vive en primitivos
reutilizables (`components/ui/`), NO en clases sueltas por pantalla. Si vas a estilar
algo, primero fijate si hay un primitivo; si no, crealo y reusalo. Así mantenemos
coherencia y evitamos la deriva que generó la inconsistencia actual.

## Personalidad

**Fino con filo.** Base elegante, ordenada, con mucho aire — pero con momentos de
energía (tipografía bold en títulos, acento eléctrico en CTAs). No es un formulario
crudo ni una marca loud de consumo masivo: es una herramienta de trabajo premium con
actitud. Prolijo Y con carácter.

Referencias de tono: Linear (orden, jerarquía, spacing) + un toque performance-brand
(tipografía confiada, acento lime en los momentos de acción).

## Color — roles claros

| Rol | Token | Uso |
|---|---|---|
| **Marca / identidad** | `--color-warm` (Pink #FACDEA dark / #C8458C light) | Avatares de marca, badges de identidad, momentos "Coevo". NO para acción. |
| **Acción / energía** | `--color-action` (Lime #BCFC11) | CTAs primarios ("Generar", "Armar"), highlights de éxito, hairlines de acento. El color que dice "hacé click acá". |
| **Calma / info** | `--color-calm` (Mint #D4FCF1) | Estados informativos, secundarios. |
| **Superficies** | `--color-surface-0..3` | Fondos en capas. 0 = más oscuro/base, 3 = más elevado. |
| **Texto** | `--color-fg` / `-secondary` / `-muted` / `-faint` | Jerarquía de texto. Nunca hardcodear hex de texto. |
| **Bordes** | `--color-edge` / `-subtle` / `-strong` / `-focus` | Separadores y contornos. |
| Semánticos | `--color-success` / `-warning` / `-error` | Estados. |

**Regla de acento**: Lime SOLO en acción. Si todo es lime, nada resalta. Un CTA lime
por pantalla (el principal). Pink para marca, no para botones de acción.

## Tipografía

- Familia: `--font-sans` (Inter). Mono: `--font-mono` (JetBrains Mono) para datos/IDs/timestamps.
- **Títulos hero**: 24–28px, `font-bold`, `tracking-[-0.02em]`. Confiados, con filo.
- **Section titles**: 13–14px, `font-semibold`.
- **Eyebrows / labels**: 10px, `font-bold uppercase tracking-[0.2em]`. El recurso "manifesto".
- **Body**: 12–13px. **Hints/meta**: 10–11px `text-fg-faint`.

## Spacing & radius

- Radius: `--radius-sm` 6px (controles), `--radius-md` 12px (cards), `--radius-lg` 16px (heroes).
- Secciones con aire: `p-5`/`p-6`, `space-y-4`/`space-y-5`. No apretar.
- Densidad: agrupá. No 30 campos al mismo nivel — core visible, resto en "Avanzado".

## Primitivos canónicos (`components/ui/`)

- `Button` — variantes: `action` (lime, CTA primario), `brand` (pink), `ghost`, `subtle`, `danger`.
- `Card` — contenedor base con surface + border + radius.
- `Section` — bloque agrupador: eyebrow opcional + título + contenido. Para estructurar forms.
- `Collapsible` — sección expandible ("Avanzado"). Core afuera, opcional adentro.
- `Field` — label + control + hint, spacing consistente.
- `Input` / `Textarea` / `Label` — controles base.

## Patrón de form (anti-"marea")

1. **Hero / brief** arriba: "Describí qué querés" → la IA arma el form (chat-first).
2. **Core visible**: lo esencial (qué generás, assets principales, objetivo).
3. **Avanzado colapsable**: resolución, motor, estilo custom, referencias, voz settings.
4. **CTA lime** abajo, fijo y claro: "Generar".

## Rollout (refactor incremental, sin romper arquitectura)

1. Foundation: tokens finales + primitivos (`Section`, `Collapsible`, `Button` variants).
2. Referencia: ConfigPanel de Fashion Reel migrado al patrón (core + avanzado + lime CTA).
3. Replicar: una pantalla por vez (UGC → Static Ad → BrandSettings → resto), siempre
   reemplazando clases sueltas por primitivos. Nunca un big-bang.

## Imagen / video en secciones

Donde aporte contexto (no decoración): preview del tool en GeneratePage, thumbnail del
resultado en cards, referencia visual en el brief. Siempre con `object-cover`, radius del
sistema, y sin romper el grid. Nada de media gratuito que distraiga.
