## Why

> *"quiero trabajar con una marca nueva y, si me conecto a su Meta, tener los reportes y toda
> esa información ahí en el dashboard. Que se vaya actualizando día a día. Si nos conectamos a
> Postiz, que se sube, sólo que yo pueda entrar al dashboard y que lo vea ahí."* (usuario, 2026-10-09)

Hoy `IntegrationsPage` y `PerformancePage` son pantallas de muestra (métricas de placeholder);
lo único real es el scraping de Instagram (Apify). No hay conexión a Meta ni a Postiz.

## What Changes

Por marca, tres integraciones que alimentan el dashboard solas:

1. **Meta orgánico** (Instagram + Facebook de la marca): alcance, interacciones, seguidores,
   rendimiento por publicación. Se conecta una vez (OAuth de Meta) y se sincroniza **todos los
   días** sin que nadie haga nada.
2. **Meta Ads**: inversión, resultados y costo por resultado por campaña y por pieza. Misma
   conexión, mismo ritmo.
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
