# modulos — un motor, módulos que aprenden

**Estado:** propuesto (2026-11-09), para revisar con Gonzalo. No se construye nada hasta aprobarlo.
Entra al tablero cuando se libere un lugar (regla: hasta 3 activos).
Maqueta: https://claude.ai/artifact/TmwZbNqejZNEVMqCxi3pb6 · Mercado: `docs/negocio/mapa-de-mercado-coevo-studio.md`.

## Por qué

1. **Hay dos motores.** Las 19 herramientas de Studio (`frontend/src/tools/`, `backend/tools/`) y las skills
   de `coevo-skills` hacen el mismo trabajo con código distinto. Lo que se mejora en uno no llega al otro.
2. **Lo producido no llega a Entregas.** Sólo 2 de 19 herramientas mandan a Entregas (UGC Creator y
   Ecommerce Pack). El resto se aprueba adentro de la herramienta y ahí queda (revisado 2026-11-09).
3. **El rechazo no enseña.** Se anota, pero no se vuelve regla de la marca.
4. **El mercado confirma que eso es lo que vale.** Video de moda en español ya lo tienen 8 de 12
   competidores; ninguno aprende de los rechazos ni de los resultados. El hueco es la memoria que aprende,
   y hoy es justo la parte que está desconectada.
5. Ya está empezado: `backend/nodes/` es un motor de grafos y `GET /api/tools/{id}/graph` sirve el grafo de
   una tool («el día que una tool corra 100% por el motor, este grafo ES la tool»). Hoy sólo lo usa
   `screen_mockup`.

## Qué cambia

- **Módulo = un contrato fijo.** Entra: la marca + el brief (casilleros: modelo, prendas, encuadres, luz y
  lugar, movimiento, voz, formato). Sale: tomas a **Entregas**. Al rechazar: un motivo de una lista fija
  (calce, cara, color de la prenda, luz, fondo, pose) que se guarda en **Marca**.
- **Un solo motor.** Cada módulo es una skill de `coevo-skills` con un `modulo.json` al lado: nombre,
  casilleros, cadena de capacidades (los nodos), costo estimado y qué herramientas viejas reemplaza.
  - Studio lo corre por el backend (una cola de trabajos con el mismo `run` para todos).
  - El chat lo corre por el MCP: una herramienta nueva, `correr_modulo(marca, modulo, brief)`.
  - Mientras se migra, el nodo puede llamar a la herramienta vieja por dentro: nada se rompe de golpe.
- **El grafo se dibuja solo.** La cadena del `modulo.json` es un `graph.json` del motor de nodos. Con eso
  Producción muestra el pipeline de cada módulo en nodos, y el mapa (`autopoiesis/red`) y el informe lo
  pueden enlazar. No se dibuja a mano en ningún lado.
- **Todo termina en Entregas**, con la toma, el brief que la produjo y el costo (Reportes).
- **Tres rechazos con el mismo motivo proponen una regla** en Marca › Lo aprendido. Una persona la
  confirma; desde ahí la heredan todos los módulos de esa marca.
- **Pantalla de tres columnas** (amplía `specs/workspace-layout`): brief con lo que viene de Marca ·
  lienzo · estilos de la marca. Con el design system de Coevo (`coevo-web/docs/design-system.md`).
- **Los nombres de las herramientas no se ven.** El equipo y el cliente ven módulos; «Ecommerce Pack» o
  «Fashion Reel» quedan como detalle interno.

### Los playbooks (así se llaman en pantalla; nombres a confirmar)

| Módulo | Qué hace | Skill | Herramientas que junta | Estado |
|---|---|---|---|---|
| **PDP** | Fichas para la tienda: prenda real, puesta, encuadres con nombre | `fotos-de-tienda` | Ecommerce Pack, Ecommerce Batch, Product Sheet | hay |
| **Lookbook** | La pieza editorial del mes: una escena, una luz, varias tomas | `persona-en-escena` | Fashion Editorial, Static Ad | hay |
| **Motion** | La foto aprobada se mueve: reel vertical | `editar-reel` | Fashion Reel, Product Clip, Video Ad Creator | hay |
| **Casting** | Caras fijas de la marca, en cuatro vistas | `doble-digital` | Avatar Sheet | hay |
| **Talking** | Una cara de la marca que habla, con voz real y permiso | `contenido-de-marca` | UGC Creator | hay |
| **Retail Kit** | Piezas para locales y franquicias, en código | `carrusel` | Carousel Creator, Static Ad | hay |
| **Material Lab** | Cambiar color o tela por partes de la prenda | — | — | **falta** |

### Reglas de oficio de cada pipeline

Detalle en la biblioteca: `ideas/prenda-fiel-en-imagen-generada.md` y `ideas/pipeline-en-nodos-con-fotos.md`.
- Cada pipeline se dibuja en nodos con seis tipos fijos (entrada · IA · herramienta · chequeo · persona ·
  salida) y una foto real por paso, desde los datos del `modulo.json`.
- Sin fotos de la prenda no se genera; si no se pudieron leer, frena con error (nunca en silencio).
- La prenda entra primero y sin nombre comercial; varias fotos, como imágenes.
- La visión hace preguntas puntuales y aconseja; aprueba una persona. Si la prenda no coincide, se corrige
  sólo la prenda; si sigue mal, la toma sale marcada.
- Una persona elige antes del paso caro (prenda fiel, animar). Se anima desde un solo cuadro.
- La hoja de casting no lleva prendas de la marca y las manos van vacías.

## Qué NO cambia

- La memoria de la marca vive en Marca (`changes/studio-v2`). Los módulos la leen, no la copian.
- Seedance sigue por kie.ai; Gemini sólo con `GEMINI_API_KEY` de Coevo; imagen por Fal.
- Nada se publica solo. Nada pago sin costo dicho.
- No es SaaS abierto (`docs/negocio/estrategia-motor.md`): opera Coevo y quien esté en la lista.

## Roadmap de Studio (propuesta)

| Fase | Qué | Cómo se sabe que salió |
|---|---|---|
| **1 · Cerrar el circuito** (nov–dic 2026) | Todo módulo manda a Entregas; motivos de rechazo fijos; regla propuesta a la tercera. Marca nueva (se lee entera, se edita en el lugar) y Bandeja que pide lo que falta | Koxis y ALGÜNA: cada pieza aprobada está en Entregas; al menos 3 reglas aprendidas por marca |
| **2 · Un motor** (ene–feb 2027) | `modulo.json` + `correr_modulo` en el MCP; Vitrina y Pasarela primero; pantalla de tres columnas; grafo de cada módulo | La misma Vitrina corre igual desde Studio y desde el chat |
| **3 · Medir y aprender** (mar–abr 2027) | Resultados publicados (Postiz) vuelven a la marca; las reglas suman «qué funcionó» además de «qué se rechazó» | Un reporte mensual por marca que dice qué cambió por lo aprendido |
| **4 · La puerta de moda** (cuando haya 3 marcas pagando por usarlo solas) | Morph con nombre nuevo: la misma central con módulos de moda. Canal posible: app en Tiendanube (Delfi ya está ahí) | 3 marcas que producen solas y pagan |

## Riesgos

- **Migrar 19 herramientas es largo.** Por eso el nodo puede envolver la herramienta vieja y se migra de a
  un módulo, empezando por los dos que más se usan.
- **Delfi** (delfiplus.com) ya vende fotos aprobadas como servicio, con app en Tiendanube y clientes como
  Falabella. Si la memoria que aprende no se nota en las entregas, competimos sólo por precio.
- `ToolRunPage.tsx` (~15.300 líneas) y `backend/main.py` (7.017) no crecen: lo nuevo va en `tools/<id>/`,
  `components/workspace/` y un router propio.
