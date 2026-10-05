# CLAUDE.md

**Coevo Studio** — plataforma interna de Coevo para producir contenido de marca con
IA, foco en moda en video. Cada marca carga sus assets una vez (Brand Kit) y todas
las herramientas los heredan.

**Mapa completo de la app:** [docs/MAP.md](docs/MAP.md) · **Índice de docs:**
[docs/README.md](docs/README.md) · **Por qué algo está como está:**
[docs/decisions-log.md](docs/decisions-log.md) — leerlo antes de reabrir una discusión.

**Spec-driven (OpenSpec):** lo que el sistema hace hoy está en `openspec/specs/`; lo propuesto,
en `openspec/changes/<cambio>/` (proposal · tasks · spec delta). Antes de construir algo nuevo,
buscar si ya hay un change; si no, proponerlo ahí primero.

> Este archivo se carga en CADA sesión: mantenerlo corto. El detalle va a `docs/`.

## Correr

```bash
./dev.sh            # backend + frontend   (./dev.sh backend | ./dev.sh frontend)
```
- Front `http://localhost:5180` (`strictPort`: si está ocupado falla, no salta).
- Back `http://127.0.0.1:8000` — usar `127.0.0.1`, no `localhost`.
- Python del venv es **3.9**: nada de `str | None`, usar `Optional[str]`.
- Verificar antes de dar por terminado: `npm run build` y `npx tsc --noEmit -p tsconfig.app.json`
  en `frontend/`. Hay ~15 errores de tsc preexistentes (`ToolConfig`/`StepContext`): el criterio
  es **cero errores nuevos**.

## Dónde está cada cosa

- **Lab** = `frontend/src/pages/ManualLabV2.tsx` (el v1 se borró el 2026-10-03; está en el historial de git).
- **`ToolRunPage.tsx` tiene ~15.300 líneas.** No sumarle lógica: extraer a
  `components/workspace/` o a `tools/<id>/`.
- **Una tool se registra en dos lados:** `frontend/src/tools/registry.ts` (handlers y
  `approvalSteps`) y `backend/tools/registry.json` (orden de pasos y `hidden`).
- **Todo HTTP pasa por `frontend/src/lib/api.ts`.** Nada de `fetch()` suelto.
- **LLMs:** pasan por `backend/services/llm_router.py`, que prefiere `NANOBANANA_API_KEY` y cae a
  `GEMINI_API_KEY`. Las dos generan texto OK (verificado 2026-10-03; el 403 de sept. ya no está).
- **Seedance va siempre por kie.ai** (`KIE_API_KEY`), nunca por Fal: `services/seedance_video.py`.
- **Patrón de pantalla compartido:** `components/workspace/` (`SelectorPanel`, `SelectorTrigger`,
  `RecipeGrid`). Los selectores abren al costado, nunca hacia abajo.
- **Color:** la fuente de verdad es `frontend/src/index.css`. Acento `--color-brand` (rosa,
  señal funcional, no relleno de CTA).

## Reglas duras

- **Nunca commitear ni imprimir `backend/.env`** ni ninguna key.
- `backend/data/` son **datos reales de clientes** (JSON, sin base de datos). Backup antes de migrar.
- Hooks de React **antes** de cualquier `return` condicional.
- **Ciclos de import = pantalla negra en dev.** El build los esconde (reordena); el dev server
  (ESM nativo) no. Nunca importar `tools/<id>/handlers.ts` desde afuera si ese archivo importa
  de su `index.ts` — mover lo compartido a un archivo sin dependencias (ej. `fashion_reel/shots.ts`).
- Antes de afirmar que un modelo, precio o endpoint existe: verificarlo. No hacer POST de
  prueba a APIs de generación — encolan y cobran.
- Todo cambio se commitea y pushea a `main` al terminarlo (cuenta gh `deimovvv`).
