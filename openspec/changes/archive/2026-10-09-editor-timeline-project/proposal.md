## Why

El usuario edita cada vez más videos **iterando por prompt con Claude** (skills `reel-marca`,
`grabar-web`, `explicar-herramienta`): Claude reescribe el montaje y él lo corrige. Lo que
falta es dónde **ver y señalar**: un timeline donde parar en el momento exacto y decir
"acá esto", en vez de escribir los segundos a mano en el chat.

> *"necesito el timeline porque yo voy modificando con prompt"* (usuario, 2026-10-08)

Además se estaban mezclando tres cosas distintas — tools, editor y skills — y eso confundía
qué es una "tool nueva". Este change fija el mapa.

## What Changes

**1. El mapa (decisión):**

| Qué | Para qué | Dónde vive |
|---|---|---|
| **Tool** | **genera** material nuevo, con pasos que el operador aprueba | la app (`tools/`) |
| **Editor** | **monta** un video con material que ya existe — uno solo, para todo | la app (`components/workspace/VideoTimeline`) |
| **Skill** | Claude produciendo en la terminal y **descubriendo** qué funciona | `coevo-skills` |

Lo que una skill valida pasa a la app como **plantilla del editor** (montaje) o **receta de
una tool** (generación). El reel de Morph no es una tool nueva: es la primera plantilla.

**2. Un formato de proyecto compartido: `timeline.json`.** Lo escriben Claude (desde una
skill) y el editor (desde la UI), en la carpeta del proyecto. Tramos con su fuente, desde
dónde, locución y rótulo; textos anclados; música. El editor lo abre desde la carpeta, lo
muestra en pistas, lo reproduce y exporta; si Claude lo cambia, el editor se recarga.

**3. Las notas vuelven a Claude:** las notas por momento se guardan en `notas.md` de la
misma carpeta, con el formato de la guía de edición (`0:12.4 — qué cambiar`), para que la
skill las lea en la próxima vuelta.

**4. Dos piezas nuevas del editor** que pide el primer caso: **locución por tramo** (el tramo
dura lo que su voz) y **tramos de imagen fija** (placas).

## Capabilities

### Modified Capabilities

- `video-editor`: abre proyectos `timeline.json` desde una carpeta; tramos con locución y de imagen.

## Impact

- Backend: leer/escribir el proyecto y servir sus archivos (con rangos: Starlette 0.36 no los
  sirve), y exportar un proyecto con FFmpeg.
- Frontend: página del editor por proyecto; `VideoTimeline` suma imagen, locución y rótulo.
- Casos de prueba: **End Cards** (`~/Downloads/endcards-clips`, montado hoy con `montar4.sh`)
  — material de **Monks**: se abre en local, **nada se copia** al repo ni a `backend/data/`.
  Después: el reel de **Morph** (`reel-marca/ejemplos/morph-ecommerce`), que necesita bloques.
