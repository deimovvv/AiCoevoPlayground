# Coevo Studio

**Plataforma interna de agencia para creación de contenido multi-marca con IA.**

Elegís una marca y todas las tools heredan su contexto — assets, ADN de marca, voz, prompts. La IA produce; vos dirigís.

---

## Qué hace

Coevo Studio es una fábrica de contenido context-aware. Cargás los assets de una marca una sola vez (avatares, productos, ropa, fondos, logos, moodboards) y quedan disponibles para **todas** las tools automáticamente. Las tools generan varias variaciones, vos elegís la mejor, y solo a la ganadora se le aplica el paso caro de animación.

### Ideas centrales

- **Tools context-aware** — elegís una marca, todas las tools heredan sus assets + guidelines.
- **Prompts de 3 capas** — default de la tool → override de marca → variables dinámicas. Editables, no hardcodeados.
- **Curación multishot** — generás variaciones, elegís la mejor, recién ahí animás.
- **Chat-first** — describís lo que querés en lenguaje natural; un agente arma la config de la tool por vos.

---

## Stack técnico

- **Frontend** — React 19 + TypeScript 5.9 + Vite 8 + Tailwind CSS v4 + React Router 7
- **Backend** — FastAPI + Python 3.11+ + Uvicorn
- **Persistencia** — archivos JSON + media local (sin base de datos en Fase 1)
- **Servicios de IA**
  - **Gemini 2.5 Flash** — guiones, chat, armado de prompts, ADN de marca, config del agente
  - **Nano Banana 2** (vía Fal) — generación y edición de imágenes
  - **GPT Image** — edición de imágenes
  - **Kling V3 Pro / V2.5 Turbo** (vía Fal) — image-to-video y frame-to-frame
  - **Seedance 2.0** (vía Fal) — reference-to-video con multi-ref + lipsync por audio
  - **ElevenLabs** — text-to-speech, Voice Design, clonado instantáneo de voz
  - **HeyGen Avatar 4** — lip-sync de foto parlante
  - **Beeble SwitchX** — swap video-a-video (prenda/producto/fondo)
  - **FFmpeg** — concatenación de video + subtítulos palabra por palabra

---

## Requisitos previos

| Requisito | Versión | Notas |
|-----------|---------|-------|
| Node.js   | 20+     | para el frontend (Vite) |
| Python    | 3.11+   | para el backend (FastAPI) |
| FFmpeg    | reciente | necesario para render/concat de video — `brew install ffmpeg` en macOS |
| Git       | cualquiera | para clonar |

---

## Arranque rápido

### 1. Clonar

```bash
git clone <repo-url>
cd AiCoevoPlayground
```

### 2. Configurar las API keys

Creá `backend/.env` (ver [`backend/.env.example`](backend/.env.example)):

```env
# Requeridas
GEMINI_API_KEY=...        # Google AI Studio
FAL_KEY=...               # fal.ai — generación de imagen + video
ELEVENLABS_API_KEY=...    # ElevenLabs — voces

# Opcionales
HEYGEN_API_KEY=...        # HeyGen — lip-sync de foto parlante
BEEBLE_API_KEY=...        # Beeble SwitchX — tool Video Swap
BEEBLE_API_BASE=...       # URL base de la API de Beeble (si no es la default)
APIFY_API_KEY=...         # Apify — scraping de Instagram (imports de Content Analyzer)
```

> **Nunca commitees el `.env`.** Está gitignoreado. Las API keys se facturan a quien sea su dueño.

### 3. Instalar dependencias

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate          # macOS/Linux
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 4. Correr

Un solo comando levanta ambos servidores con logs prefijados (Ctrl+C corta los dos):

```bash
./dev.sh                 # backend :8000 + frontend :5173
./dev.sh backend         # solo backend
./dev.sh frontend        # solo frontend
```

O corrélos manualmente:

```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate
python -m uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

Abrí **http://localhost:5173**.

---

## Tools

11 tools activas más un sandbox sin marca (Manual Lab).

| Tool | Categoría | Qué hace |
|------|-----------|----------|
| **UGC Creator** | video | Avatares hablando a cámara — guion → imagen base → multishot → voz → lip-sync → render (con/sin subtítulos). Edición por clip. |
| **Video Ad Creator** | video | Ads cinematográficos — storyboard, keyframes, animación frame-to-frame con Kling, voz en off, render. |
| **Fashion Reel** | video | Reels editoriales de moda, sin hablar. Modo Story o modo Looks. Frame-to-frame auto/manual. Edición por clip en el animate. |
| **Product Clip** | video | Videos cortos de producto, sin personas — movimiento de producto frame-to-frame. |
| **Video Swap** | video | Cambiá prenda/producto/fondo en **tu propio** video, manteniendo sujeto + movimiento (Beeble SwitchX). |
| **Static Ad** | imágenes | Ads estáticos listos para publicar — 40 templates de composición. |
| **Carousel Creator** | imágenes | Carruseles multi-slide con historia visual consistente. |
| **Product Spotlight** | imágenes | Fotografía profesional de producto en contexto. |
| **Ad Creative Lab** | imágenes | Batch de creativos a partir de imágenes de referencia + extracción de guía visual. |
| **Avatar Creator** | imágenes | Generá nuevos avatares de marca o pose sheets para los existentes. |
| **Content Analyzer** | imágenes | Analizá cualquier video, extraé guion/escenas/estilo, mapealo a tus assets de marca, recreá. |
| **Manual Lab** | sandbox | Chat sin marca: Nano Banana 2 + Kling + Seedance directo, con tagging de refs `[image1]`/`[image2]`, encadenado multi-turno y galería. En `/dashboard/lab`. |

Ver [`docs/tools.md`](docs/tools.md) para pipelines, inputs y reglas completas.

---

## Estructura del proyecto

```
frontend/src/
  pages/              # vistas por ruta (Generate, ToolRun, BrandSettings, ManualLab, ...)
  components/         # componentes feature + layout + primitivas ui
  tools/              # por tool: index.ts (schema/handlers) + handlers.ts
  lib/                # api.ts (cliente backend), BrandContext, utils
backend/
  main.py             # app FastAPI — todos los endpoints
  services/           # integraciones de IA (gemini, fal, elevenlabs, heygen, beeble, ffmpeg, agent, ...)
  tools/              # registry.json + default_prompt.txt por tool
  data/               # storage JSON + media de marca (ver "Datos" abajo)
docs/                 # arquitectura, tools, stack, pipeline, diseño, onboarding
dev.sh                # runner de desarrollo local (backend + frontend)
```

---

## Datos y qué se sube al repo

Los assets de contexto de marca **se trackean** para que un clon llegue listo para usar:

- ✅ `backend/data/brands.json` — todas las configs de marca
- ✅ `backend/data/avatars/`, `products/`, `clothing/`, `backgrounds/`, `moodboards/`, `logos/` — media de contexto de marca

Los outputs generados pesados y los archivos de runtime están **gitignoreados**:

- ❌ `backend/data/renders/` — videos generados (pueden llegar a GBs)
- ❌ `backend/data/generations.json` — historial de generaciones
- ❌ `backend/data/ig-imports/`, `backend/tmp/` — transitorios

---

## Agregar una tool nueva

1. `backend/tools/{tool_id}/default_prompt.txt` — template de prompt con `{variables}` y bloques `{?cond}...{/cond}`.
2. Registrar en `backend/tools/registry.json` con sus pasos de pipeline.
3. `frontend/src/tools/{tool_id}/index.ts` — `ToolDefinition` (schema + step handlers).
4. Registrar en `frontend/src/tools/registry.ts`.

---

## Documentación

- [`docs/architecture.md`](docs/architecture.md) — diseño del sistema, endpoints, estructuras de datos
- [`docs/tools.md`](docs/tools.md) — todas las tools: prompts, pipelines, inputs, reglas
- [`docs/stack.md`](docs/stack.md) — tecnologías, servicios, entorno
- [`docs/pipeline.md`](docs/pipeline.md) — flujos de generación, optimización de costo, PromptBuilder
- [`docs/client_onboarding.md`](docs/client_onboarding.md) — qué pedirle a los clientes (brief de marca, assets)
- [`docs/design_language.md`](docs/design_language.md) — sistema de diseño, tokens, componentes
- [`docs/product_vision_ux.md`](docs/product_vision_ux.md) — filosofía de UX, flujos de usuario

---

## Notas

- **Todavía no hay auth.** No expongas la app públicamente sin un gate — no hay login y las llamadas a la API facturan a las keys configuradas.
- **macOS/Linux** es el entorno de desarrollo principal.
- **CORS** permite todos los orígenes para desarrollo local.

## Licencia

Propietario — Coevo Agency
