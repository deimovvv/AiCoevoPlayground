# storyboard-y-mesas — la campaña como espacio de trabajo: mesas, storyboard y variantes por cuadro

**Estado:** propuesto (2026-11-28). Gonzalo vio el boceto y dio el OK para escribir el change («sí»).
Sale de mirar Piko Club (canvas por proyecto, storyboard numerado, reviews). No usamos Piko porque es pago.
Tomamos de ahí dos ideas, la vista de storyboard y un espacio de trabajo por campaña, y las rehacemos
con lo que Studio ya tiene: Entregas, el Lab, la memoria de la marca y el conector de Claude.

## Por qué

- **No hay storyboard en Studio.** Hoy un storyboard es un JPG armado a mano
  (`~/cov/archivos/koxis/video-modelo/storyboard/storyboard-koxis-12s.jpg`). El cliente no puede aprobar
  un cuadro solo, ni comentar «el #5».
- **No hay dónde trabajar en equipo.** Cada uno genera en su compu o en el Lab, y lo generado queda suelto.
  «Generadas en esta campaña» son cientos o miles de imágenes: así nadie encuentra la buena.
- **No queda la historia de cada cuadro.** No se sabe de dónde salió la imagen que está en el storyboard
  ni qué otras opciones hubo.

## Qué cambia

**La campaña pasa a ser el espacio de trabajo, en tres pantallas** (boceto en `boceto/`, con las fotos del
storyboard real de Koxis; las imágenes no van al repo, salen de `~/cov/archivos/koxis/video-modelo/storyboard/`):

1. **Campaña** (Producción → Campañas → una campaña). La portada tiene tarjetas grandes en tres grupos:
   **Mesas**, **Storyboards** y **Entregas al cliente**. La misma lista va a la izquierda. Es lo que en Piko
   es el proyecto.
2. **Mesa**: el lugar donde alguien trabaja, por persona o por escena («Saco verde · Gonzalo · #4–#6»).
   Todos ven todas las mesas y cada uno trabaja en la suya. Nuestro canvas es la mesa: un Lab abierto
   dentro de la campaña, sin canvas nodal.
   - Lo generado se agrupa **por cuadro** (#4, #5, #6 y «Sin cuadro»). La que está en el storyboard va
     marcada, y al lado van todas sus variantes.
   - Cada imagen tiene ★ (elegida), «→ usar en #5», ver grande y descargar.
   - Arriba, una tira con los cuadros de esa mesa tal como están en el storyboard.
   - A la izquierda va **«Con Claude»**: lo que se le pidió y lo que hizo, con sus decisiones
     («descarté una porque cortaba la cara»). Debajo, las **recetas** (opciones de un cuadro, variar la
     luz, mismo plano en 9:16 y 4:5, revisar contra la marca, animar el cuadro). **«A mano»** es la
     segunda pestaña: el Lab con la marca y la campaña ya cargadas.
3. **Storyboard**: es una **entrega** de tipo `storyboard`, con sus rondas, comentarios y aprobación.
   - Las etapas de la pieza van arriba: Guion → Storyboard → Animatic → Final.
   - Los cuadros van numerados y agrupados por clip, con su tiempo y qué pasa en cada uno.
   - Cada cuadro tiene su estado (aprobado, pide cambio o nuevo) y su charla: cliente, equipo y Claude.
   - Se puede ver grande (con flechas y la tira de cuadros), descargar uno o todos, y mostrar las guías
     9:16 y 4:5 sobre el cuadro.
   - **Variantes del #5**: todo lo que se generó para ese cuadro, con un clic para cambiar la que está en
     uso, y **«Ir a la mesa donde se generó»**.
   - **Reemplazar** un cuadro abre un panel al costado, ordenado así: primero lo marcado «para el #5»,
     después las ★ de todas las mesas y recién al final el resto, con buscador. La imagen anterior queda
     como variante.

**El número de cuadro es el puente.** Cuando se genera algo «para el #5», en la mesa o desde el Claude de
cualquiera, queda atado a ese cuadro. El storyboard y la mesa leen lo mismo.

**Claude trabaja desde el chat de cada uno** (claude.ai o Claude Code), con el conector de Studio.
Studio no tiene chat propio: la mesa muestra lo que hizo Claude. Un chat adentro de Studio se piensa
más adelante, cuando se piense cómo venderlo.

**Lo que ya existe y se usa:**
- `Delivery.items`, las rondas, `history`, `DeliveryComment.item_id` (comentario por lámina) y `kind`
  (lo que se corrige tres veces pasa a ser regla de la marca): el storyboard no necesita otro sistema
  de comentarios.
- `ManualLabV2.tsx` es la pestaña «A mano», abierta con la marca y la campaña.
- `campaigns.json` sigue siendo la campaña: las mesas la referencian por id y no se migra.
- Las tools del MCP (`subir_entrega`, `ver_entrega`, `nueva_ronda`, `clasificar_comentario`).

## Por pasos (cada uno se prueba antes del siguiente)

1. **Storyboard en Entregas.** Tipo `storyboard`, cuadros con número, clip, tiempo y texto, aprobar o
   pedir cambio por cuadro, ver grande, descargar y guías de recorte. Por el MCP: subir un storyboard y
   leer el estado de cada cuadro. Prueba: el video con modelo de Koxis subido como storyboard.
2. **Reemplazar un cuadro y sus variantes.** Se cambia una imagen sin abrir una ronda nueva para todo,
   la anterior queda como variante y «Variantes del #N» funciona.
3. **Mesas.** Tablas, la portada de la campaña con tarjetas, la mesa agrupada por cuadro, ★, «→ usar en
   #N» e «Ir a la mesa». Por el MCP: `ver_mesas`, `subir_a_mesa(mesa, archivos, para_cuadro, nota)` y
   `poner_en_cuadro(storyboard, n, imagen)`.
4. **«Con Claude» y recetas.** Lo que hizo Claude se guarda como nota de cada tanda subida a la mesa.
   Las recetas copian el pedido para pegarlo en tu Claude (Studio no tiene chat). «A mano» abre el Lab
   con la campaña cargada.

Desde claude.ai, escribir depende del paso 3 de `studio-en-claude`: las herramientas que escriben,
sólo para el equipo. Desde Claude Code anda antes, con el MCP local.

## Qué NO cambia

- **No hay canvas nodal** (cables entre modelos, como Piko): es lo caro y no lo necesitamos.
- **No hay chat de Claude adentro de Studio**, por ahora.
- El cliente sigue viendo sólo Entregas: las mesas son del equipo.
- Generar desde Studio con sus llaves no entra acá: las imágenes llegan de la mesa («A mano», que ya
  genera hoy) o del Claude de cada uno.
