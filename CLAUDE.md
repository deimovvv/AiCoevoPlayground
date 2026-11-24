# CLAUDE.md

**Coevo Studio** — plataforma interna de Coevo para producir contenido de marca con
IA, foco en moda en video. Cada marca carga sus assets una vez (Brand Kit) y todas
las herramientas los heredan.

**Mapa completo de la app:** [docs/MAP.md](docs/MAP.md) · **Índice de docs:**
[docs/README.md](docs/README.md) · **Por qué algo está como está:**
[docs/decisions-log.md](docs/decisions-log.md) — leerlo antes de reabrir una discusión.

**Dónde va cada cosa (regla, 2026-10-09):**
- Lo que el sistema hace **hoy** (contrato) → `openspec/specs/<capacidad>/`.
- Lo que se está **construyendo** → `openspec/changes/<cambio>/` (proposal · tasks · spec delta).
  Antes de construir, buscar si ya hay un change; si no, proponerlo ahí primero. **Al terminarlo,
  su contrato pasa a `specs/` y la carpeta a `changes/archive/AAAA-MM-DD-<cambio>/`.**
- Todo lo demás → `docs/`: `negocio/`, `producto/`, `guias/`; arriba sólo MAP, README, decisions-log, backlog.

> Este archivo se carga en CADA sesión: mantenerlo corto. El detalle va a `docs/`.

## Correr

```bash
./dev.sh            # backend + frontend   (./dev.sh backend | ./dev.sh frontend)
```
- Front `http://localhost:5180` (`strictPort`: si está ocupado falla, no salta).
- Back `http://127.0.0.1:8000` — usar `127.0.0.1`, no `localhost`.
- Base de datos: **Postgres 16 en Docker** (`docker-compose.yml`, 127.0.0.1:5433). `dev.sh` la levanta y
  aplica las migraciones. Tablas nuevas: modelo en `backend/db/models.py` → `alembic revision --autogenerate`
  → `alembic upgrade head`. Nunca `create_all`. Los JSON de `backend/data/` se migran de a uno (`changes/infra-v1`).
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
- **LLMs:** pasan por `backend/services/llm_router.py` con **`GEMINI_API_KEY` (la de Coevo) o fallan**.
- **Seedance va siempre por kie.ai** (`KIE_API_KEY`), nunca por Fal: `services/seedance_video.py`.
- **Patrón de pantalla compartido:** `components/workspace/` (`SelectorPanel`, `SelectorTrigger`,
  `RecipeGrid`). Los selectores abren al costado, nunca hacia abajo.
- **Color y tipo:** la fuente de verdad es `frontend/src/index.css`. Tema por defecto **claro, paleta «sistema»**
  (la de la web: grises fríos, celeste fino, Instrument Sans + Geist Mono); `--color-brand` es la señal
  (salmón en claro, rosa en oscuro), nunca relleno de CTA. `?paleta=papel` vuelve a la anterior.
- **Navegación (studio-v2):** barra arriba (`TopBar.tsx`): marca · Marca · Producción · Entregas · Bandeja · Reportes.

## Reglas duras

- **Nunca commitear ni imprimir `backend/.env`** ni ninguna key.
- **Nunca una key de Google de Monks/Pixel** (`NANOBANANA_API_KEY` era la de Pixel): ni texto, ni
  imagen, ni video. Google sólo con `GEMINI_API_KEY` de Coevo; imagen por Fal; Seedance por kie.
- `backend/data/` son **datos reales de clientes** (JSON, sin base de datos). Backup antes de migrar.
- Hooks de React **antes** de cualquier `return` condicional.
- **Ciclos de import = pantalla negra en dev.** El build los esconde (reordena); el dev server
  (ESM nativo) no. Nunca importar `tools/<id>/handlers.ts` desde afuera si ese archivo importa
  de su `index.ts` — mover lo compartido a un archivo sin dependencias (ej. `fashion_reel/shots.ts`).
- Antes de afirmar que un modelo, precio o endpoint existe: verificarlo. No hacer POST de
  prueba a APIs de generación — encolan y cobran.
- Todo cambio se commitea y pushea a `main` al terminarlo (cuenta gh `deimovvv`).

<!-- equipo:inicio (lo mantiene la skill informe: informe.py equipo <repo>; no editar a mano) -->
## Cómo trabajamos en este repo (todo el equipo, en la compu o en claude.ai/code)
- **Al empezar:** `git pull`. Leé `informe.md` (estado, decisiones, próximo paso) y los avisos abiertos de `ESTADO.md`.
- **Cómo arranca un proyecto:** primero `/autopoiesis` (el chequeo): dice qué systems tocan ahora, cuáles después y cuáles no aplican, y queda en `informe.md`. Primero la estrategia (auditoría, mercado, Foundation, Brand…, cada una con su skill); la producción visual va después: las aplicaciones de la marca (lista fija en `design-system/references/aplicaciones.md`) en un canvas de Claude Design por marca, las campañas en otro canvas, lo aprobado a Studio. Lo técnico (backend, base de datos, deploy) no tiene skill del método: se hace directo.
- **Tres chats por marca, con el mismo nombre que su link.** «<Marca> · Informe» para el rumbo (estado, decisiones, systems, `/autopoiesis`); «<Marca> · Estrategia Creativa» para pensar qué decimos y por qué, e iterarlo; «<Marca> · Contenido» para producir (plantillas en Aplicaciones, piezas finales a Studio). Si en uno de esos chats aparece algo de la web o de otro tema de la misma marca, se hace ahí mismo: no hace falta pasar el contexto a otro chat. Cada persona tiene sus propios chats con esos nombres (nadie ve los chats de otro): lo compartido es el repo, los tres links y Studio. Al empezar, `git pull`; al terminar, commit y una línea en el informe. En claude.ai, un proyecto por marca con esos tres chats adentro. **Para no perder el hilo:** antes de irte por un rato largo, decí «guardá el hilo» y Claude escribe en el informe, en una línea, dónde quedaron (qué hacían, qué falta, en qué archivo). Lo que es de otra marca, como aviso a ese proyecto («avisale a X»).
- **Clientes de una marca (los de Morph, los de Coevo):** viven en el repo de quien les vende, en `docs/clientes/<cliente>/` (la auditoría, la estrategia, la propuesta, las decisiones con fecha), y en Coevo Studio (la identidad, las reglas aprendidas, las entregas con rondas, los comentarios y los links que el cliente ve). El repo es para pensar y documentar; Studio, para producir y entregar. El cliente nunca ve el repo: ve lo que sale por Studio. Los chats llevan el nombre del cliente («Koxis · Contenido»). Si el cliente necesita web o código propio, pasa a tener su repo (como `kooris-web`).
- **Memoria:** cuando alguien dice «anotá esto», va a `informe.md` (decisión con fecha y quién, esta semana, próximo). Lo que le sirve a otro proyecto, como aviso en el `ESTADO.md` de ese proyecto. Lo aprendido usando una skill, en su `LEARNINGS.md` (repo autopoiesis).
- **Al terminar cada cosa:** commit y push enseguida. Notas, informe y ESTADO, directo a `main`; código, en una rama.
- **Un documento, un link.** Antes de publicar, buscar si el documento ya tiene link: si lo tiene, publicar encima (mismo link); una versión nueva («v2», «v3») va en el mismo link, no en uno nuevo. Dónde se anotan los links: si el proyecto es de una marca que está en Coevo Studio, en Studio → Marca → Archivos (cada link dice si el cliente lo ve; por defecto no). Si no hay marca en Studio, en `LINKS.md`, en la raíz: `- nombre · link · qué es · fecha`.
- **Un tablero de Pinterest por marca, siempre con las mismas secciones** (01 · Sistema … 12 · Plantillas, 90 · campaña, 99 · No: los mismos números en el canvas de Aplicaciones, el tablero y el informe), creado desde la cuenta de la marca o de Coevo, nunca desde una personal. La lista está en `design-system/references/aplicaciones.md`.
- **Estrategia Creativa compartida por familia, una página por marca.** Coevo y Morph comparten el link «Coevo y Morph · Estrategia Creativa»; ALGÜNA y FH, el suyo. Cada página sale del archivo de su marca, en su repo (Coevo: `coevo-web/docs/systems/estrategia-creativa.md`; Morph: `morph-site/docs/estrategia-creativa/morph.html`), y `python3 ~/cov/autopoiesis/skills/informe/scripts/estrategia.py <familia>` arma el link entero con una portada que dice el estado y quién edita cada página. **Cada uno edita sólo la página de su marca;** para la del otro, un comentario en el link. Si al publicar el sistema avisa que hay una versión más nueva: `git pull` en los dos repos, volver a armar y publicar. Informe y Aplicaciones siguen siendo uno por marca.
- **Ningún link nuevo sin el OK de Gonzalo.** En un proyecto de marca, Claude publica sólo en sus tres links fijos. Para cualquier otro link (un tablero, un borrador, una propuesta) primero pregunta: «¿creo un link nuevo para X, o lo sumo a uno de los tres?». Lo de siempre es sumarlo: el documento va en `docs/` (con sus imágenes: `![pie](ruta)`) y se lee adentro del informe.
- **Tres links por marca, siempre con el mismo nombre, más Studio.** **«<Marca> · Informe»** (`informe.html`, `url:` en `informe.md`): dónde estamos — el mapa de los systems, las decisiones y lo próximo; cada system abre su documento completo (el `.md` del repo) a página completa. **«<Marca> · Estrategia Creativa»**: qué decimos y por qué — la idea, las líneas de contenido, las versiones para iterar (v1, v2… en el mismo link). **«<Marca> · Aplicaciones»**: el canvas de Claude Design donde se ejecuta — una página por aplicación con los números de `aplicaciones.md` (01 · Sistema … 12 · Plantillas, 90 · campaña, 99 · No). **Coevo Studio**: las piezas finales — Entregas con rondas y aprobación, publicar en la pauta y traer los resultados (Meta y pauta; la pestaña «Resultados» está en camino). **El recorrido de una pieza:** se decide en Estrategia Creativa → se define cómo se ve en Aplicaciones → la pieza final se sube a Studio, se aprueba y se publica → lo que dio vuelve al Informe. Para cambiar un documento se le pide a Claude en el chat que corresponde: edita el `.md` y vuelve a publicar en el mismo link. Una herramienta temporal (un tablero para votar) se archiva cuando se decide y el resultado pasa a uno de los tres links. Los links se anotan en Studio → Marca → Archivos (o en `LINKS.md` si la marca no está en Studio).
- **Una sola lógica visual.** Lo que decide es **para quién es la página**, no en qué etapa está. Las páginas para gestionar (informe, tablero, auditoría, chequeo, plan, mapa de mercado) se ven igual que el informe: el registro Base del Design System de Coevo (fondo gris claro, Instrument Sans y Geist Mono, grilla con líneas de 1px, acento celeste mínimo; el CSS está en `autopoiesis/skills/informe/scripts/informe.py`). Arriba lleva una barra con el nombre de la marca y «← Informe», que vuelve al informe del proyecto. Lo que va a salir para alguien de afuera (propuesta, dossier para un curador o una convocatoria, pieza, web) se hace desde el primer borrador con el design system de la marca que lo firma: su `DESIGN.md` o `docs/design_system.md`, o la identidad en Studio. Si esa marca todavía no tiene design system, se usa el registro interno. **Nunca se inventa una estética para una página.**
- **Dónde va cada cosa.** Documento interno (system, estrategia, plan, informe): el texto vive en el repo y se ve en un link de claude.ai; borrador y versión final en el mismo link, el equipo comenta ahí. Pieza para un cliente (video, animatic, carrusel, reel): entrega en Coevo Studio con sus rondas, nunca un link suelto. Documento que se le manda al cliente (propuesta, presupuesto): el borrador como link interno; lo que sale (PDF o link aparte) se anota en Studio marcado «el cliente lo ve».
- **Reglas para todos:** este bloque es igual en todos los proyectos. Una regla nueva para todos se escribe una sola vez en `autopoiesis/skills/informe/plantillas/equipo.md` y llega sola a cada proyecto al abrir la próxima sesión (no hace falta avisar proyecto por proyecto).
- **Si el push rebota:** `git pull --rebase`, juntar las dos versiones y volver a subir. Nunca `--force`.
- **El link del informe** (`url:` en `informe.md`) se actualiza desde una compu con las skills (`informe.py build` y publicarlo en el mismo link). Desde la web alcanza con guardar `informe.md`: la próxima sesión en una compu del equipo avisa que hay que publicarlo.
<!-- equipo:fin -->
