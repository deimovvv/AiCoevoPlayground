# Postiz y pauta — lo justo para entender

## Publicar no es pautar

- **Publicar (orgánico):** el post sale en el Instagram/TikTok de la marca, gratis. Lo ven sus
  seguidores y quien el algoritmo elija.
- **Pautar (anuncios):** se **paga** para que lo vea más gente, elegida (edad, zona, intereses).
  Se hace en el **Administrador de anuncios de Meta**, con la cuenta publicitaria y la tarjeta
  **del cliente**. Las métricas que importan: inversión, alcance y **costo por resultado**.

**Postiz publica; no pauta.** Programa los posts orgánicos y trae sus métricas.

## Postiz en una frase

Un calendario donde cargás los posts de todas tus marcas, salen solos a la hora que elegiste, y
después te muestra cómo le fue a cada uno. Con API: Coevo puede leer esas métricas y mostrarlas.

## Quién paga qué

- **Pagás vos una sola cuenta** (agencia). Los clientes **no** pagan Postiz.
- Se cobra por **canales**: un canal = una cuenta de red conectada (el Instagram de Koxis es 1, su
  TikTok es otro).
- Planes (verificado 2026-10-09): Standard US$29 (5 canales) · Team US$39 (10) · **Pro US$49
  (30)** · Ultimate US$99 (100). Sin plan gratis; prueba de 7 días.
- Ejemplo: marcas con Instagram + Facebook + TikTok = 3 canales → Pro alcanza para **10 marcas**,
  unos **US$5 por marca por mes**. Conviene sumarlo al fee mensual del cliente.
- Postiz también es **código abierto** (AGPL) y se puede instalar en un servidor propio, pero
  arrastra 9 servicios (incluido Elasticsearch): no compensa ahorrar US$49.

## Cómo se conecta un cliente

1. En Postiz creás el **cliente** (se llama "customer").
2. Le mandás un **link de invitación**: entra, autoriza su Instagram en la pantalla de Meta, y
   listo. No te pasa la contraseña.
3. Para que apruebe antes de publicar: **link de vista previa** de la semana.

## Pautar desde Coevo, ¿se puede?

Sí, pero no ahora. Hace falta la **API de Marketing de Meta**: el acceso básico es sólo para
desarrollo; para usarla con anunciantes reales piden **revisión de la app**, **verificación del
negocio** y un historial de 500 llamadas exitosas en 15 días. Semanas de trámite. Mientras
tanto, la pauta se maneja en el Administrador de anuncios con **acceso de socio** a la cuenta
del cliente (se da desde su Business, sin programar nada).

## El ciclo con Coevo Studio

```
 Coevo genera la pieza ─▶ el editor la termina ─▶ se programa en Postiz ─▶ sale
        ▲                                                                  │
        └──── lo que funcionó vuelve como receta o plantilla ◀── métricas ─┘
```
El dashboard de Coevo es donde queda **la memoria**: qué pieza, con qué receta, y cómo le fue.
