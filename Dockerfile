# Backend de Coevo Studio para producción (openspec/changes/infra-v1).
# FastAPI + FFmpeg + Node/Remotion (grabar textos) + OpenCV (revisión del export).
#   docker build -t coevo-api .
# ── Etapa 1: compilar el frontend (sólo para el build; no queda en la imagen final) ──
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Vacío = misma dirección que la API (el backend sirve el frontend): un solo login, sin CORS.
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# ── Etapa 2: la imagen que corre ──
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

# FFmpeg · Node (Remotion) · librerías que pide el Chrome headless de Remotion
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg nodejs npm ca-certificates curl tini \
      libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 libxrandr2 \
      libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 \
      libglib2.0-0 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python (capa aparte: sólo se reinstala si cambia requirements.txt)
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

# Remotion: sólo lo que usa el render (no todo el frontend)
COPY frontend/package.json frontend/package-lock.json frontend/
RUN cd frontend && npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npx remotion browser ensure
COPY frontend/src/remotion frontend/src/remotion
COPY frontend/src/components/workspace/TextLayer.tsx frontend/src/components/workspace/textLayerModel.ts frontend/src/components/workspace/

# Backend
COPY backend backend

# Frontend compilado: lo sirve el backend en la misma dirección (main.py, al final)
COPY --from=web /web/dist frontend/dist

WORKDIR /app/backend
EXPOSE 8000
# Migraciones al arrancar y después la API. tini reenvía señales (apagado limpio).
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
