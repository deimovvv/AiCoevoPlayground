# MCP de Studio por HTTP (openspec/changes/studio-en-claude). No se publica solo: la API recibe /mcp,
# valida el token de la persona y reenvía acá por la red interna de Docker.
FROM node:22-bookworm-slim
WORKDIR /mcp
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY *.mjs ./
ENV MCP_PORT=3001 STUDIO_API_URL=http://api:8000 COEVO_STUDIO_URL=https://app.coevoagency.com
USER node
CMD ["node", "http.mjs"]
