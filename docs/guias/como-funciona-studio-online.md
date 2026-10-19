# Cómo funciona Coevo Studio online (explicado sin tecnicismos)

Guía para entender las piezas y cómo se conectan. Se completa a medida que se construye.
Detalle técnico y comandos: [produccion.md](produccion.md). Por qué se decidió cada cosa:
[decisions-log.md](../decisions-log.md).

---

## El mapa en una imagen

```
  Vos / el equipo (navegador)          Claude en tu Mac (las skills)
            │                                     │
            │ login con PIN                       │ llave de servicio
            ▼                                     ▼
   ┌──────────────── Cloudflare ────────────────────┐
   │  Access: ¿quién sos? ¿estás en la lista?       │
   │  Túnel: el único camino hasta el servidor      │
   └────────────────────────┬───────────────────────┘
                            ▼
   ┌──────────── Servidor (Hostinger VPS) ──────────┐
   │  Studio (app + API) ── vuelve a chequear el    │
   │                         login antes de responder│
   │  Base de datos (Postgres) · archivos · backups │
   └────────────────────────────────────────────────┘
```

## Las piezas, una por una

**El servidor (VPS de Hostinger).** Una computadora alquilada que está prendida siempre. Ahí corre
Studio, la base de datos y los backups. No tiene ninguna puerta abierta a internet salvo SSH (para
que nosotros entremos a administrarla, sólo con llave).

**El túnel de Cloudflare.** Como el servidor no tiene puertas abiertas, ¿cómo llega la gente? El
servidor llama él a Cloudflare y deja una línea abierta. Cuando alguien entra a
`app.coevoagency.com`, Cloudflare le pasa el pedido por esa línea. Nadie puede llegar al servidor
por otro lado.

**Cloudflare Access (el portero).** Antes de dejar pasar a nadie, pregunta quién es. Hay dos formas
de contestar:
- **Una persona:** pone su mail y recibe un PIN. Si el mail está en la policy "Equipo Coevo", pasa.
- **Una máquina (Claude):** muestra una llave de servicio (`claude-local`). Si está en la policy
  "Claude", pasa. No necesita PIN porque no hay nadie para leer el mail.

**El JWT (el sello).** Cuando el portero deja pasar a alguien, le pone un sello firmado al pedido:
"este es gonzalo@…, lo verifiqué yo". Studio **vuelve a mirar ese sello** antes de responder
(`backend/services/access_guard.py`). ¿Por qué dos veces? Porque el 2026-10-17 la app de Access no
estaba guardada y la app quedó pública unos minutos. Con el segundo control, aunque Cloudflare se
configure mal, Studio no muestra nada sin sello.

**La base de datos (Postgres).** Donde se guardan las cosas nuevas (proyectos de video, entregas,
comentarios). Lo viejo todavía está en archivos JSON (`backend/data/`) y se va mudando de a poco.
Cada cambio en la forma de la base es una **migración** (un archivo en `backend/alembic/versions/`):
el servidor las aplica solo al arrancar.

**El MCP `coevo-studio`.** Un programa chico que corre en tu Mac y le da a Claude "herramientas"
para hablar con Studio: ver una marca, bajar un avatar, subir una entrega, leer comentarios. Usa la
llave de servicio. Es lo que hace que una skill no tenga que guardar datos de la marca en su
carpeta: los pide a Studio. Instalación: [mcp/coevo-studio/README.md](../../mcp/coevo-studio/README.md).

## El circuito de una entrega (lo primero que conecta todo)

1. Claude produce una pieza (ej. un carrusel) leyendo la marca con `ver_marca`.
2. Con tu OK, la sube con `subir_entrega` → aparece en **Entregas** de esa marca.
3. Alguien la mira en Studio: clic sobre una lámina = comentario en ese punto. Aprueba o pide cambios.
4. Le decís a Claude "revisá los comentarios de la entrega X". Lee con `ver_entrega` (cada
   comentario trae la lámina y el punto), corrige y sube con `nueva_ronda`.
5. Marca resueltos los comentarios aplicados (`resolver_comentario`). Vuelve al paso 3.

Cada ronda queda guardada: los comentarios dicen a qué ronda se referían.

## Llaves: quién tiene qué

| Llave | Para qué | Dónde vive |
|---|---|---|
| PIN por mail | personas | no se guarda: llega cada vez |
| Token de servicio `claude-local` | Claude en tu Mac | `~/.coevo-studio-token` (sólo tu usuario lo lee) |
| Keys de IA (Fal, kie, Gemini…) | generar | `backend/.env` del servidor — nunca en el repo |
| Llave SSH | administrar el servidor | `~/.ssh/coevo_vps` |

Regla: **una llave por persona o máquina**. Si alguien se va, se borra la suya sin tocar las demás.
Una llave que pasó por un chat, un mail o una captura se **rota** (se genera otra y la vieja deja de andar).

## Glosario mínimo

- **Deploy:** subir el código nuevo al servidor y reiniciar Studio.
- **Migración:** un cambio en la forma de la base de datos, versionado.
- **Policy:** una regla de Access ("estos mails pueden entrar").
- **Endpoint / API:** una dirección del servidor que responde datos (ej. `/api/brands`).
- **MCP:** forma estándar de darle herramientas a Claude.
