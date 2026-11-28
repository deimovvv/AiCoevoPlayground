# Tareas — storyboard-y-mesas

## 1 · Storyboard en Entregas
- [x] 1.1 (2026-11-28, rama `storyboard-en-entregas`) `Delivery.kind = "storyboard"`; cada item suma `frame` (número), `clip`, `time` y `caption`, y su estado (`approved`, o `rejected` para pide cambio). Sin migración: `items` es JSONB
- [x] 1.2 (2026-11-28; quedó `POST /api/deliveries/{id}/items/{item_id}/state` `{state: ok | cambio | null}`; un cliente sin permiso de aprobar no puede poner «ok») API: aprobar o pedir cambio de un cuadro (`PATCH /api/deliveries/{id}/items/{item_id}`), con los mismos permisos que comentar
- [x] 1.3 (2026-11-28; las etapas de arriba quedan para después; la charla del cuadro es la lámina grande que ya existía) Vista de storyboard en `DeliveriesPage` como componente aparte (`components/workspace/StoryboardView.tsx`): etapas arriba, cuadros por clip, estado, charla del cuadro a la derecha (`DeliveryComment.item_id`)
- [ ] 1.4 (hecho: ver grande, descargar un cuadro y guías 9:16 y 4:5; falta «Descargar todo» antes de aprobar) Ver grande (flechas, tira, Esc), descargar un cuadro, «Descargar todo» (reusar `deliveries/aprobadas`) y guías 9:16 y 4:5
- [x] 1.5 (2026-11-28; el mismo componente, en modo cliente) Vista del cliente: los mismos cuadros, sin mesas ni variantes; puede aprobar y comentar por cuadro
- [x] 1.6 (2026-11-28) MCP: `subir_entrega` acepta `tipo: "storyboard"` con `cuadros: [{numero, clip, tiempo, texto}]`; `ver_entrega` devuelve el estado y los comentarios de cada cuadro
- [ ] 1.7 Prueba: subir el storyboard del video con modelo de Koxis (9 cuadros) y aprobar y comentar desde la vista del cliente

## 2 · Reemplazar un cuadro y sus variantes
- [ ] 2.1 `item.variants: [{url, source, author, at, mesaItemId?}]`: al reemplazar, la imagen en uso pasa a variantes y no sube la ronda de toda la entrega
- [ ] 2.2 Panel «Reemplazar» al costado: primero lo marcado para el cuadro, después las ★ de las mesas, después todo (con buscador); subir archivo; otras entregas
- [ ] 2.3 «Variantes del #N» en la charla del cuadro: un clic cambia la que está en uso
- [ ] 2.4 MCP: `poner_en_cuadro(entrega, numero, url | imagen_de_mesa)`

## 3 · Mesas
- [ ] 3.1 Tablas `mesas` (id, brand_id, campaign_id, nombre, dueño, cuadros, created_at) y `mesa_items` (id, mesa_id, url, frame, star, author, via: claude · mano · subida, note, generation_id, created_at): modelo + alembic
- [ ] 3.2 Portada de la campaña con tarjetas (Mesas · Storyboards · Entregas) y la lista a la izquierda
- [ ] 3.3 Pantalla de la mesa: tira «En el storyboard», grupos por cuadro, ★, «→ usar en #N», ver grande, descargar
- [ ] 3.4 «Ir a la mesa donde se generó» desde el storyboard (`/mesa/{id}#c5`)
- [ ] 3.5 MCP: `ver_mesas(campana)`, `subir_a_mesa(mesa, archivos, para_cuadro, nota)`
- [ ] 3.6 Prueba: Gonzalo y alguien más trabajan dos mesas de la misma campaña desde Claude Code; las imágenes caen en su cuadro

## 4 · «Con Claude» y recetas
- [ ] 4.1 «Con Claude»: las notas de cada tanda subida (`mesa_items.note`), en orden, como lo que hizo Claude
- [ ] 4.2 Recetas: botones que copian el pedido para pegarlo en tu Claude (lista en la mesa; cada una apunta a una skill)
- [ ] 4.3 «A mano»: `ManualLabV2` abierto con marca, campaña y mesa; lo que genera cae en la mesa
- [ ] 4.4 Docs: `docs/guias/` (cómo se trabaja una campaña con mesas) y la guía de prueba para Gonzalo
