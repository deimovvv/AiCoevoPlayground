## Context

Diseño completo del editor: `docs/video-editor.md`. Este archivo suma lo aprendido
de la guía de RoboNuggets *"Automate your video editing with Sonnet 5.5"* (PDF que
pasó el usuario el 2026-10-05), la del editor RUBRIC que se vio en el video.

Se toma el **método**, no los prompts textuales.

## Lo que la guía agrega a nuestro diseño

### 1. Las notas tienen formato y una regla de alcance

Cada nota es **timestamp + cambio**, y el pedido cierra con *"change only what I
listed and keep everything else exactly as it is"*.

→ Al regenerar desde un comentario: tocar **sólo** el clip comentado. Ni el orden, ni
los recortes, ni los otros clips cambian. Es un requisito, no una preferencia.

### 2. Cada corrección se vuelve una regla, con su motivo

*"Add every fix I asked for as a rule, with the reason behind it, so you don't
repeat the mistake."*

→ **Ya existe dónde guardarlo:** `brand.designSystem.motion_rules`. El generador de
Fashion Reel ya lo inyecta como `BRAND MOTION RULES (mandatory)` en cada animación
(`handleAnimate`). Un comentario del editor puede ofrecer *"guardar como regla de la
marca"*, y desde ahí corrige todos los videos siguientes de esa marca. Es el ciclo de
aprendizaje que mostraba el video, conectado a un campo que ya se lee.

### 3. Aprobar el texto antes de cortar (talking heads)

En el corte automático: *"before you cut anything, show me the full text you plan to
keep so I can ok it"* y *"only remove things. never reorder or rewrite what I said."*

→ Para el corte automático de UGC (segunda etapa): mostrar la transcripción que queda
y aprobarla **antes** de cortar. Sólo quitar; nunca reordenar ni reescribir.
Transcripción: ElevenLabs Scribe v2 (~$0.22 por hora, ya tenemos la cuenta) o
AssemblyAI (~$0.21 por hora) — precios de la guía, septiembre 2026, sin verificar.

### 4. Control de calidad automático después del render

*"Check frames from the start, middle and end and fix anything that covers my face
or runs off screen."*

→ Paso automático post-export: extraer 3 frames con FFmpeg y revisarlos (cara tapada,
texto cortado). Es lo que se hizo a mano con el video del Pixel.

## Herramientas para la capa de marca por código (§6 de video-editor.md)

| Herramienta | Qué es | Estado |
|---|---|---|
| **HyperFrames** (`github.com/heygen-com/hyperframes`) | open source de HeyGen: página web → mp4 | candidata frente a Remotion (que ya usamos para subtítulos). **Sin verificar** |
| **Refero Styles** (`styles.refero.design`) | +2.000 design systems de marcas reales, escritos para agentes (DESIGN.md) | referencia para el design system de marca del backlog (#8) |

La guía cierra con la idea que importa: *"la parte fácil es el prompt; lo que paga es
el design system"*. Para Coevo, el design system es por marca y vive en el Brand Kit.

## Relectura de la guía (2026-10-06) — lo que faltaba

El PDF que volvió a pasar el usuario (`Sonnet 5.5 Video Editing Guide (1).pdf`) es
**el mismo archivo** (mismo hash). Esta vez se leyó entero; esto no estaba anotado:

### 5. Qué modelo usa y por qué

| | Sonnet 5.5 | Opus 5.5 | Fable 5.1 |
|---|---|---|---|
| Entrada / 1M tokens | $2 | $4 | $10 |
| Salida / 1M tokens | $10 | $20 | $50 |
| Velocidad (tokens/s) | 139 | 92 | 70 |
| Puntaje de inteligencia | 56 | 58 | 53 |
| Costo por tarea de prueba, esfuerzo máximo | $7.60 | **$5.98** | $7.63 |

Fuente que cita la guía: Artificial Analysis, Intelligence Index v4.3.2, 30-09-2026.
**Sin verificar por nosotros.**

Lo que importa: por token Sonnet cuesta la mitad, pero **por tarea Opus salió más
barato** a esfuerzo máximo (Sonnet gasta más tokens para terminar). La guía elige Sonnet
porque cada prompt dice exactamente cuándo está terminado ("done looks like…") — con una
meta así de clara, un modelo más barato y rápido alcanza.

→ Para Coevo: la generación de la capa de gráficos (§7) es una tarea con meta clara
(duración fija, design system fijo, frames revisados). Empezar con Sonnet 5.5 a esfuerzo
medio y medir; pasar a Opus 5.5 si falla. Medir **costo por pieza**, no por token.

### 6. Cómo arma la animación (paso 2 de la guía)

- Construye el video con **HyperFrames**: el agente escribe una página web y la
  herramienta la graba a mp4.
- Gráficos que acompañan lo que se dice: títulos cortos, palabras clave, números,
  diagramas simples, el logo real de lo que se nombra.
- **Cada gráfico se sincroniza con la transcripción**: aparece cuando se dice la palabra.
- Dos layouts que alterna: persona a pantalla completa / persona en un panel a la
  derecha con los gráficos a la izquierda.
- Reglas duras: sólo colores, fuentes y formas del `DESIGN.md`; no tocar voz ni
  footage; **el video dura exactamente lo mismo que el corte** (si no, se desincroniza).
- Cierre: render 1920×1080 y revisar frames de inicio, medio y final (cara tapada,
  algo fuera de cuadro) — ya anotado en §4.

### 7. La capa de texto en Coevo (pedido del usuario, 2026-10-06)

*"¿acá no se debería poder poner subtítulos o textos? … html? animaciones js? hyperframe?"*

**Sí, y la arquitectura ya lo permite:** el editor reproduce los clips en el navegador,
así que el texto se puede mostrar como una capa HTML **encima** del reproductor, al
instante, sin renderizar. Sólo al exportar se graba.

Dos niveles, en este orden:

1. **Textos manuales** (sin IA, determinístico): una pista "Texto" en el timeline con
   bloques que tienen inicio/fin, texto, posición y un estilo de la marca (título,
   nombre de prenda, precio, CTA). Fuentes y colores salen del Brand Kit. Es lo que
   piden las piezas de moda: el texto en video generativo se deforma, por código no.
2. **"Animar con IA"**: el modelo (Sonnet/Opus 5.5) escribe la composición HTML de los
   gráficos a partir del guion, los tiempos de los clips y el design system de la marca.
   El usuario la corrige con las mismas notas por timestamp del editor. Es el paso 2 + 3
   de la guía, dentro del producto.

**Motor de render — decisión abierta:**

| | Remotion (ya lo usamos) | HyperFrames |
|---|---|---|
| Qué es | React → video | HTML/CSS/JS → video (Chrome headless cuadro a cuadro + FFmpeg) |
| En Coevo hoy | sí: subtítulos karaoke (`services/subtitle_render.py`, `frontend/src/remotion/`) | no |
| Para que lo escriba un modelo | menos natural: componentes React a compilar | **natural**: un HTML suelto, GSAP / CSS / Lottie |
| Licencia | requiere licencia de empresa para equipos grandes — **verificar** antes de vender | Apache 2.0 (verificado 2026-10-06, 57k estrellas, Node 22+) |

Recomendación: nivel 1 con lo que ya hay (overlay en el navegador + Remotion al
exportar, que ya graba subtítulos). Probar HyperFrames recién para el nivel 2, donde
la ventaja de "un modelo escribe HTML" es real. No sumar un segundo motor sin necesidad.
