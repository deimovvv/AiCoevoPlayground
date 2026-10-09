## Why

> *"quiero trabajar con una marca nueva y, si me conecto a su Meta, tener los reportes y toda
> esa información ahí en el dashboard. Que se vaya actualizando día a día. Si nos conectamos a
> Postiz, que se sube, sólo que yo pueda entrar al dashboard y que lo vea ahí."* (usuario, 2026-10-09)

Hoy `IntegrationsPage` y `PerformancePage` son pantallas de muestra (métricas de placeholder);
lo único real es el scraping de Instagram (Apify). No hay conexión a Meta ni a Postiz.

## Hallazgo (2026-10-09): Postiz ya resuelve lo difícil de Meta

Verificado en docs.postiz.com: el cliente conecta sus cuentas a Postiz con un **link de
invitación** (sin pasar contraseñas), y Postiz trae **métricas por canal y por publicación**
de 10+ redes (Instagram, Facebook, TikTok, YouTube, LinkedIn, X, Threads…), también por su
**API pública** (`GET /public/v1/analytics/{canal}?date=7|30|90`, 30 pedidos por hora) y por
MCP. O sea: **la revisión de app de Meta, los tokens y los cambios de API los maneja Postiz.**
Coevo no necesita su propia integración con Meta para lo orgánico.

Límites a tener en cuenta: mira hacia atrás 7/30/90 días (para tener historia hay que guardar
cada día); Meta **Ads** (inversión, costo por resultado) no aparece en Postiz. Plan Cloud con API:
desde $29/mes (5 canales) hasta $99 (100 canales).

## What Changes

Por marca, tres integraciones que alimentan el dashboard solas:

1. **Métricas orgánicas vía Postiz**: Coevo lee de la API de Postiz, **todos los días**, las
   métricas de cada canal y de cada publicación de la marca, y las guarda (así se arma la
   historia más allá de 90 días). Sin integración propia con Meta.
2. **Meta Ads** (opcional, después): inversión y costo por resultado. Éste sí necesita la
   Marketing API de Meta propia; sólo si un cliente paga pauta con Coevo.
3. **Postiz** (publicación): lo que se aprueba en Coevo Studio se programa en Postiz; el
   dashboard muestra qué está programado, qué salió y cuándo, y lo cruza con las métricas de
   Meta de esa publicación.

El valor que ningún tablero suelto da: **cerrar el círculo** — una pieza que salió de una tool
o del editor se ve después con sus números, y lo que funciona vuelve como receta o plantilla.

## Capabilities

### New Capabilities
- `brand-integrations`: conectar Meta y Postiz por marca y sincronizar a diario.

## Impact

- Necesita lo que hoy no existe: **guardar credenciales por marca de forma segura**, **tareas
  programadas** (sincronización diaria) y una **base de datos** para series de métricas (los
  JSON en `backend/data/` no alcanzan). Es el mismo salto que piden los proyectos de video por
  marca y "que otras personas lo usen": usuarios, permisos y almacenamiento real.
- Verificar antes de construir (regla del repo): permisos y revisión de app de Meta (Graph API,
  Marketing API) y la API de Postiz (si es la versión alojada o propia).
