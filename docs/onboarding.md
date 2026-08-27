# Onboarding — Coevo Studio

Guía para alguien que entra al proyecto sin haberlo escrito. Está pensada para un perfil
**creativo técnico**: no hace falta ser developer, sí hace falta entender por qué una
decisión de prompt cambia el resultado.

El orden importa. Cada paso existe porque el siguiente no se entiende sin él.

---

## 0. Qué es esto, en una frase

Una plataforma que produce contenido de marca —fotos de catálogo, reels, UGC, ads— donde
**el contexto de cada marca entra solo en cada generación**. Elegís una marca y todas las
herramientas heredan sus prendas, sus modelos, su dirección de arte y sus reglas.

No es un wrapper de un modelo. Lo que tiene valor es la capa de arriba: cómo se arma el
prompt, qué referencias se mandan y en qué orden, y qué se hace con lo que vuelve.

---

## 1. Que corra en tu máquina

### Lo que necesitás instalado

```bash
node --version     # 18 o más
python3 --version  # 3.11 o más
ffmpeg -version    # si no está: brew install ffmpeg
```

FFmpeg no es opcional: es lo que pega los clips de video al final de un reel. Sin él, todo
lo demás anda pero el render falla.

### Traer el proyecto

```bash
git clone <url-del-repo> AiCoevoPlayground
cd AiCoevoPlayground
```

De acá en adelante, para actualizar:

```bash
git pull origin main
```

**Trabajamos con branch → PR → merge a main.** No hace falta que pushees nada para
empezar; con leer y correr alcanza.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Las **API keys van en `backend/.env`** y ese archivo **no está en git** (está en
`.gitignore`, nunca se commiteó, y así tiene que seguir). Pedíselas a Gonzalo por otro
canal. Las que hacen falta para trabajar de verdad:

```
GEMINI_API_KEY=…        # guiones, chat, análisis, extracción de marca
FAL_KEY=…               # imágenes (Nano Banana) y video (Kling) — la más importante
ELEVENLABS_API_KEY=…    # voz, solo para UGC
```

Levantar:

```bash
python -m uvicorn main:app --reload --port 8000
```

Ojo con un detalle que hace perder media hora: **usá `127.0.0.1:8000`, no
`localhost:8000`.** Si hay Docker corriendo, `localhost` puede resolver a un contenedor
distinto y vas a ver 404 raros. El frontend ya apunta a `127.0.0.1`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre en http://localhost:5173

---

## 2. Generá algo real, antes de leer una línea de código

Esto es lo más importante de toda la guía. **El prompting no se entiende leyendo, se
entiende viendo la causalidad.**

1. Entrá a **Marcas** y elegí **Koxis** o **Garcon Garcia** (son las que tienen más
   material cargado: prendas, modelos, poses).
2. Sidebar → **Coevo Studio** → **Fashion Reel**.
3. Modo **Looks**. Elegí una prenda, un modelo, y tildá dos planos: *Plano general* y
   *Plano detalle*.
4. Corré el pipeline entero: guion → imagen base → multishot → animar → render.

Vas a esperar unos minutos y vas a gastar plata real (unos **$2 a $4** en un reel de
cuatro tomas). Está bien: es parte de aprender cuánto cuesta cada decisión.

Cuando termine, andá a **Trabajo**: la pieza aparece con su costo real en la fila.

---

## 3. Rompé algo a propósito

Ahora sí, la parte que enseña.

Abrí `frontend/src/tools/fashion_reel/index.ts` y buscá `VIDEO_SHOT_CATALOG`. Cada plano
tiene dos textos:

- `framing` → se inyecta en el prompt de la **imagen**
- `motion` / `motionVariants` → se inyecta en el prompt del **video**

Cambiá el `framing` del plano `detail`. Por ejemplo, sacale la parte que dice que la cara
tiene que quedar en cuadro. Volvé a correr y mirá qué pasa.

Vas a ver **identity drift**: la modelo deja de ser la misma entre planos. Eso está
documentado en el `decisions-log` y es una de las razones por las que ese texto está
escrito exactamente así.

Repetí el ejercicio con otra cosa: cambiá `SETTING (LOCKED)` por algo suelto y mirá cómo
el fondo empieza a inventarse solo.

**Esa es la habilidad del puesto.** No escribir el código: saber qué frase sostiene qué
resultado.

---

## 4. Recién ahora, el código

En este orden:

| Archivo | Qué vas a entender |
|---|---|
| `backend/services/prompt_builder.py` | Las 3 capas: prompt por defecto de la tool → override por marca → variables dinámicas |
| `backend/tools/fashion_reel/default_prompt.txt` | Cómo se ve una plantilla con `{variables}` y bloques condicionales `{?var}…{/var}` |
| `frontend/src/tools/fashion_reel/handlers.ts` | El pipeline real: cómo se arman las referencias, en qué orden, y con qué cap |
| `frontend/src/tools/shared/brandConstraints.ts` | Qué parte de la marca entra en cada tool, y qué se excluye cuando el usuario ya eligió |
| `frontend/src/lib/costLedger.ts` | Cómo se mide lo que cuesta cada corrida |

**Lo que NO tenés que leer todavía:** `ToolRunPage.tsx` tiene casi 15.000 líneas. Es el
motor de ejecución de todas las tools y no hace falta entenderlo para trabajar. Si algo
te lleva ahí, preguntá antes de meterte.

---

## 5. Leé el decisions-log

[`docs/decisions-log.md`](decisions-log.md) es lo más valioso del repo para tu perfil.

No dice qué hace el código: dice **por qué está así**, qué se probó antes y qué salió mal.
Cada entrada nació de un problema real de output.

Algunas para empezar:

- Por qué todos los planos de video mantienen la cara en cuadro
- Por qué lo que elegís en una corrida le gana a la dirección de arte de la marca
- Por qué el cliente no encarga trabajo desde su portal, solo deja notas
- Por qué el costo se registra en el momento y no se puede reconstruir después

Si tenés que contar este proyecto en una entrevista, **contá tres decisiones de estas con
el problema que las causó.** Vale más que cualquier recorrido por el código.

---

## 6. Mapa para la búsqueda de Mercado Libre

Lo que piden, y dónde vive acá:

| Lo que piden | Dónde mirarlo |
|---|---|
| **Dynamic prompting con JSON** para parametrizar prompts | `prompt_builder.py` (3 capas) + `backend/tools/registry.json` + los catálogos de shots con framing y motion por plano |
| **Videos de producto** para vendedores, a escala | Fashion Reel (`tools/fashion_reel`) y Product Clip |
| **Virtual try-on** en imagen y video | Ecommerce Pack (prenda sobre modelo) + el sistema de Consistencia (anchor de identidad y de producto) |
| **Mejora de imágenes** de producto | `ImageEditPanel`, bg remover, Product Sheet |
| **Clips cortos** tipo red social | Fashion Reel multi-shot en 9:16 |

Las cinco cosas que enumera esa búsqueda ya existen acá en alguna forma. La conversación
no es "sé de esto", es **"esto ya lo hice, funciona, y sé lo que cuesta cada pieza"**.

---

## 7. Reglas de trabajo

- **Nunca commitees `backend/.env`.** Está ignorado; que siga así.
- Tampoco `.claude/settings*.json`, archivos `.bak`, ni imágenes sueltas de prueba.
- `backend/data/` son datos reales de marcas de clientes. Si vas a probar algo que escribe
  ahí, avisá antes — ya pasó que datos de prueba aparecieran en el portal de un cliente.
- Antes de un cambio grande, leé el `decisions-log`. Buena parte de las ideas "obvias" ya
  se probaron y hay una razón escrita de por qué no quedaron.

---

## 8. Si algo no arranca

| Síntoma | Causa casi siempre |
|---|---|
| El backend no levanta | Falta alguna key en `.env`, o no activaste el venv |
| 404 raros en las llamadas | Estás pegándole a `localhost` en vez de `127.0.0.1` (Docker de por medio) |
| El render falla al final | FFmpeg no está instalado |
| Las imágenes viejas no cargan | Las URLs de `fal.media` expiran. No hay nada que recuperar |
| Pantalla en negro en una ruta | Algún `useState` quedó después de un return condicional |

Más detalle en [`setup.md`](setup.md) y en la sección de debugging del `CLAUDE.md`.
