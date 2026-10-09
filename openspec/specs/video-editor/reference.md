# Editor de video — referencia del formato y de la API

Contrato para quien construya sobre el editor (otra pantalla, otro backend, una skill).

## `timeline.json` — versión 1

Un proyecto es una carpeta con `timeline.json`. Rutas relativas a la carpeta.

| Campo | Tipo | Qué es |
|---|---|---|
| `version` | `1` | versión del formato |
| `title` | string | nombre del video |
| `width`, `height` | int | tamaño del cuadro (ej. 1080×1920, 1600×900) |
| `fps` | int | cuadros por segundo del export (30) |
| `background` | `#rrggbb` | fondo detrás de fuentes que no llenan el cuadro |
| `segments` | `Segment[]` | los tramos, en orden |
| `texts` | `TextBlock[]` | textos anclados (`textLayerModel.ts`) |
| `music` | `MusicTrack \| null` | música (`musicModel.ts`) |
| `notes` | `TimelineComment[]` | notas del editor (espejo de `notas.md`) |
| `theme` | `{headline, body, accent}` | tipografía y acento si no hay marca |
| `_*` | cualquiera | campos propios de quien escribe: se conservan |

**Segment**

| Campo | Tipo | Qué es |
|---|---|---|
| `id` | string | único en el proyecto (`t01`…) |
| `src` | ruta | video o imagen (`.png/.jpg/.webp` = placa fija) |
| `in` | s | desde qué segundo de la fuente (video) |
| `out` | s | hasta qué segundo (video sin voz) |
| `voice` | ruta | locución del tramo; arranca con el tramo |
| `extra` | s | segundos después de la voz, con silencio |
| `duration` | s | largo explícito (gana sobre todo lo demás) |
| `overlay` | ruta | PNG transparente del tamaño del cuadro, encima |
| `label` | string | nombre que se ve en el timeline |

**Largo de un tramo:** `duration` · si no, voz + `extra` · si no, `out − in` · si no,
archivo − `in` · imagen sin datos: 3 s. Fuente más corta que el tramo → se congela su último
cuadro.

**Notas (`notas.md`)**, una por línea: `- 0:12.4 · t05 — qué cambiar`.
Regla para quien las aplica: cambiar sólo lo anotado.

## API (backend FastAPI, `http://127.0.0.1:8000`)

| Método y ruta | Recibe | Devuelve |
|---|---|---|
| `GET /api/editor/project?path=` | carpeta | `{dir, project, mtime, media:{ruta: duración\|null\|"missing"}, notes}` |
| `GET /api/editor/project/mtime?path=` | carpeta | `{mtime}` — para detectar cambios de Claude |
| `PUT /api/editor/project` | `{path, project, base_mtime}` | `{mtime}` · **409** si cambió en disco |
| `PUT /api/editor/notes` | `{path, notes:[{t, segment, text, status}]}` | `{count}` — escribe `notas.md` |
| `GET /api/editor/file?project=&path=` | archivo | el archivo, con rangos (206) |
| `POST /api/editor/export` | `{path, segments:[{src,in,duration,voice?,overlay?}], texts?, theme?, font_families?, font_urls?, music?}` | `{file, duration, qa}` — en `<carpeta>/export/` |
| `POST /api/video/concat` | `{video_urls, trims, …}` | video pegado con recortes (runs de tools) |
| `POST /api/video/text-overlay` | `{video_url, blocks, theme, font_urls}` | textos grabados (Remotion) |
| `POST /api/video/music` | `{video_url, music_url, start, volume, fade_out}` | música mezclada |
| `POST /api/music/upload` · `/api/music/beats` | archivo · `{music_url, start, length}` | tema subido · `{bpm, beats}` |
| `POST /api/video/qa` | `{video_url, base_url, texts}` | `{checked, issues}` |

**Seguridad (local):** carpetas permitidas: `~/Downloads`, `~/Documents`, `~/Desktop`, `~/cov`.
Nada de un proyecto se copia a `backend/data/`.

**Límites actuales (para un backend multiusuario):** proyectos en carpetas locales, sin
usuarios ni permisos; Starlette 0.36 no sirve rangos en `/static` (el editor los resuelve
con su propio endpoint). Ver `openspec/changes/video-editor-next`.
