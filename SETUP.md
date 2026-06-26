# Setup del equipo — Coevo Studio

Guía corta para trabajar en equipo. Para la instalación completa (Node, Python, deps),
ver [`docs/setup.md`](docs/setup.md).

---

## 1. Tus assets son LOCALES (no se comparten por git)

Desde ahora, `backend/data/` (marcas, avatares, productos, prendas, etc.) **vive en tu
máquina** y **NO viaja por git**. Cada uno tiene sus propios assets. Un `git pull` solo
trae **código**, nunca toca tus assets.

> Por qué: antes los assets se commiteaban y un `pull` pisaba lo que cada uno tenía
> cargado. Ahora son locales para que eso no pase.

### Primer pull después de este cambio (UNA sola vez)

La primera vez que traigas el commit que sacó `backend/data/` de git, el pull intenta
borrar los archivos que antes estaban versionados. Para quedarte **solo con lo tuyo**:

```bash
# 1. Guardá TU brands.json en un lugar seguro
cp backend/data/brands.json /tmp/mis-marcas.json

# 2. Limpiá el cambio local de ese archivo para que el pull no choque
git checkout -- backend/data/brands.json

# 3. Traé los cambios
git checkout main && git pull

# 4. Volvé a poner TU brands.json (ya queda ignorado por git → local para siempre)
cp /tmp/mis-marcas.json backend/data/brands.json
```

Resultado: quedan **tus** imágenes (nunca se tocaron) y **tus** marcas (las restauraste
en el paso 4). De ahí en más, `git pull` nunca más toca `backend/data/`.

> ⚠️ NO hagas un `cp -rn backend/data.backup/* backend/data/` general: eso te devolvería
> también los assets de otra persona. Con los 4 pasos de arriba te quedás solo con lo tuyo.

---

## 2. Arrancar la app

```bash
# Backend (SIEMPRE con el venv activado — si no, faltan yt-dlp y otras deps)
cd backend
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows
python -m uvicorn main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm run dev
```

En Windows, asegurate de que el `.bat`/acceso directo arranque el backend **con el venv**.
Si el backend corre con el Python del sistema, no encuentra `yt-dlp` → el Content Analyzer
falla.

---

## 3. Content Analyzer — requisitos por máquina

El análisis de video usa **ffmpeg/ffprobe**, que se instalan **por máquina** (no viajan en
el repo):

- **macOS:** `brew install ffmpeg`
- **Windows:** `winget install ffmpeg` (queda en el PATH; reabrí la terminal después)

Verificá con `ffmpeg -version`.

### Descarga de video por URL

- **TikTok / YouTube:** funcionan por URL directa.
- **Instagram:** IG bloquea descargas anónimas. yt-dlp intenta usar las cookies de tu
  navegador, así que **funciona si estás logueado a Instagram en Chrome o Firefox** en
  esa máquina. Si igual falla (IG rate-limitea tu IP), usá el botón **Upload Video**:
  bajás el reel a tu compu y lo subís como archivo.

---

## 4. Flujo de git

- Trabajamos sobre **`main`**. Para traer lo último: `git checkout main && git pull`.
- Si tenés cambios locales en archivos versionados y el pull choca: `git stash` → `git pull` → `git stash pop`.
- Tus assets (`backend/data/`) están ignorados, así que no generan conflictos.
