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
  },
})
