import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  server: {
    // Listen on IPv4 (127.0.0.1) + IPv6 + LAN. Without this Vite binds IPv6-only,
    // so links opened in a new tab via 127.0.0.1 get ERR_CONNECTION_REFUSED.
    host: true,
    // Puerto PROPIO de Coevo. Sin esto Vite usa el 5173 por defecto, que en esta
    // máquina suele estar tomado por otro proyecto (MONKS/Google-App) — Vite
    // entonces salta al 5174 en silencio y abrís el proyecto equivocado.
    // strictPort: si el 5180 está ocupado, FALLA en vez de saltar sin avisar.
    port: 5180,
    strictPort: true,
    open: true,
  },
})
