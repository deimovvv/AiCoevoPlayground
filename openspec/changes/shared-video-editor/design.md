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
