## Why

El editor ya monta, corrige y exporta (contrato: `openspec/specs/video-editor/`). Lo que falta
es lo que lo vuelve un producto para otros, no sólo una mesa para Claude:

> *"¿Cómo se supone que realizás un video nuevo? ¿Desde la UI?"* — *"el design system lo
> agarraría del que tenemos cargado de esa marca"* — *"si te gustó un estilo de video, ¿cómo
> lo guardás?"* — *"pensando en el largo plazo… que otras personas lo puedan utilizar"*
> (usuario, 2026-10-09)

## What Changes

**1. Proyectos de video por marca, en el servidor.** Un video nuevo se crea **dentro de una
marca**: el material sale de su biblioteca (Contenido: lo que generaron las tools; Brand Kit:
fotos, logos, voces; subidas, que quedan guardadas en la marca) y el look —tipografía,
colores, logo— sale del Brand Kit sin elegir nada. El formato sigue siendo `timeline.json`;
cambia **dónde vive**: en el servidor, por marca. La carpeta local queda como **puente** para
Claude en la terminal y para material de terceros (End Cards / Monks).

**2. "Nuevo video" desde la UI**, tres entradas al mismo proyecto:
- desde la biblioteca de la marca (elegir clips y fotos, se arma en ese orden);
- desde una tool ("Abrir en editor" al final de Fashion Reel, Product Clip, Video Ad);
- desde una plantilla (punto 3).

**3. Plantillas de estilo.** "Guardar como plantilla" guarda **la forma del video sin su
material**: los huecos (ej. "persona hablando 3 s", "feed de 12 fotos", "cierre con logo y
CTA"), los estilos de texto, el ritmo, el tipo de música. **No guarda la marca**: al usarla en
otra marca toma su tipografía, colores y logo. Lo que una skill valida (el reel de Morph) entra
igual: como plantilla.

**4. Bloques animados** (lo que pide la plantilla de Morph): feed que se llena, grilla que se
aleja con un clip en el centro, palabra gigante, tiras de fotos, cierre con logo y "Enviar
mensaje". Piezas que se arrastran al timeline y se anclan como los textos.

**5. Las skills escriben `timeline.json`** en vez de `montar*.sh` (pedido pasado a la sesión de
`coevo-skills` el 2026-10-09).

**6. Lo que ya estaba pendiente:** el editor en Product Clip y Video Ad Creator (UGC en espera
por decisión del usuario), "Abrir en editor" desde Contenido / Lab / Campañas, frame de
portada, subtítulos desde la voz, corte automático de talking heads, "animar con IA".

## Capabilities

### Modified Capabilities
- `video-editor`: proyectos por marca en el servidor, nuevo video, plantillas, bloques.

## Impact

- Backend: almacenamiento de proyectos por marca (hoy JSON en `backend/data/`; a futuro base de
  datos y storage de archivos — ver `docs/MAP.md` §5), API para que Claude lea/escriba un
  proyecto del servidor.
- Frontend: entrada "Nuevo video", selector de biblioteca, "Guardar como plantilla", bloques.
