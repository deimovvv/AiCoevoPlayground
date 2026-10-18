# studio-v2 — Studio reducido a su uso real

**Estado:** propuesto (2026-10-17), para revisar con Gonzalo. No se construye nada hasta aprobarlo.

## Por qué

Studio creció tool por tool: hoy tiene ~25 rutas y 7 entradas en el menú (Inicio, Campañas, Marcas,
Generar, Contenido, Lab, Ajustes), y cada tool trae su pantalla. Ahora que está online
(`app.coevoagency.com`) y lo van a usar el equipo y los clientes, el uso real es más simple:

1. **Onboardear cada marca una vez**: design system, moodboards, avatares/casting, productos, voces, plantillas.
2. **Producir para la marca** con esa información: nosotros (y Claude) operamos.
3. **Entregar**: el cliente ve, aprueba, comenta y sube lo suyo.
4. **Medir**: reportes de Postiz.

Además cambió cómo se produce. Claude ya genera piezas desde el design system de la marca (los carruseles
de `coevo-web`, el video con `timeline.json`) y deja un documento editable donde una persona ajusta
textos y orden. Studio no tiene que reimplementar eso: tiene que **guardar la memoria de la marca,
dársela a Claude y recibir lo que vuelve**.

## Qué cambia

- **Cinco secciones**: Marca · Producción · Entregas · Reportes · Ajustes. Barra **arriba**, con el
  selector de marca a la izquierda; todo lo que se ve es de la marca elegida.
- **Login con roles**: el mismo login de Cloudflare Access para todos; la app decide qué ve cada mail.
  Equipo → todas las marcas, opera. Cliente → sólo su(s) marca(s): ve, aprueba, comenta, sube assets.
  Reemplaza al portal por link (que sigue andando durante la transición).
- **Plantillas por marca**: una plantilla = layout que conoce el design system + huecos (texto, imagen,
  video) + reglas. Claude las usa para producir; Studio las guarda y versiona.
- **Claude escribe en Studio** (token de servicio, `infra-v1` 4.3): lee la memoria de la marca y sube
  piezas y fuentes editables como entregas.

## Qué NO cambia

- Las tools siguen existiendo (son los pipelines); se entran desde Producción, no desde el menú.
- El editor de video es uno solo (`specs/video-editor`).
- Nada de SaaS abierto: entra quien está en la lista (`docs/negocio/estrategia-motor.md`).

## Riesgos

- **50 personas** en el plan gratis de Cloudflare Zero Trust (equipo + clientes). Después ~US$7/persona/mes
  o login propio.
- Mover el menú rompe la memoria de uso del equipo: se hace en una sola vez, no de a poco.
