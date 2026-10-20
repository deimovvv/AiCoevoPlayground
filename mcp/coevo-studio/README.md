# MCP `coevo-studio`

El puente entre el taller (Claude Code + las skills de `coevo-skills`) y Coevo Studio: Claude lee la
memoria de cada marca y escribe en Studio sin pasar por el login con PIN.
Por qué existe: `openspec/changes/studio-v2/design.md` §8.

## Herramientas

| Herramienta | Qué hace |
|---|---|
| `listar_marcas` | marcas y qué tiene cargado cada una |
| `ver_marca` | la marca en bloques: quién es · identidad gráfica · dirección de foto y video · caras · catálogo |
| `bajar_archivo` | baja un avatar, prenda, moodboard o fondo a una carpeta local |
| `ver_poses` | poses curadas de Coevo (maniquí gris) |
| `ver_notas_cliente` / `marcar_nota_resuelta` | lo que pidió el cliente en el portal |
| `ver_generaciones` | últimas corridas de tools de la marca, con costo |
| `proyectos_video` / `ver_proyecto_video` / `guardar_proyecto_video` | timelines guardados en Studio (con versión: 409 si cambió) |
| `ver_entregas` / `ver_entrega` | entregas de la marca y sus comentarios (lámina + punto + ronda) |
| `subir_entrega` / `nueva_ronda` / `resolver_comentario` | subir una pieza a Entregas, subir la versión corregida, cerrar comentarios |
| `registrar_costo` | anotar en Studio lo que costó una generación hecha desde una skill (suma al gasto del mes de la marca, aparece como «Claude (skill)») |

El circuito completo, explicado: [docs/guias/como-funciona-studio-online.md](../../docs/guias/como-funciona-studio-online.md).

## Instalación (una vez por máquina)

```bash
cd mcp/coevo-studio && npm install
claude mcp add --scope user coevo-studio -- node "$PWD/server.mjs"
npm run check        # prueba la conexión
```

- **Llave:** token de servicio de Cloudflare Access en `~/.coevo-studio-token` (`chmod 600`):
  `CF_ACCESS_CLIENT_ID=…` y `CF_ACCESS_CLIENT_SECRET=…`. En Cloudflare: app "Coevo Studio" →
  policy "Claude" (Service Auth, token `claude-local`). Nunca en el repo ni en el chat.
- **Contra el Studio local:** `COEVO_STUDIO_URL=http://127.0.0.1:8000` (no usa llave).
