## 0. Antes de construir

- [x] 0.1 API de Postiz: métricas por canal y por publicación, grupos de clientes, links de invitación, MCP (2026-10-09).
- [ ] 0.2 Verificar permisos de Meta (Instagram Graph API, Marketing API) y si hace falta revisión de app.
- [ ] 0.3 Decidir dónde viven credenciales, tareas programadas y métricas (base de datos).

## 1. Métricas vía Postiz

- [ ] 1.1 Asociar cada marca de Coevo a su grupo de clientes en Postiz (API key en .env).
- [ ] 1.2 Sincronización diaria: métricas por canal y por publicación, guardadas en la base (infra-v1).
- [ ] 1.3 PerformancePage con datos reales (reemplaza el placeholder) y reporte mensual en el portal del cliente.
- [ ] 1.4 (Después, opcional) Meta Ads con la Marketing API propia.

## 2. Postiz

- [ ] 2.1 Conectar Postiz por marca.
- [ ] 2.2 Programar una pieza aprobada; ver su estado en el dashboard.
- [ ] 2.3 Cruzar cada publicación con sus métricas de Meta.

## 3. Estados y planificación (2026-10-31)

- [ ] 3.1 Estados de pieza en Entregas: en desarrollo, por revisar, lista, en Postiz, publicada, pausada, descartada (tablero).
- [ ] 3.2 Cada entrega lleva su ángulo (de `strategy.angles`); el MCP `subir_entrega` lo acepta.
- [ ] 3.3 Vista semana y mes por marca, con el ángulo del mes según `strategy.calendar`.
- [ ] 3.4 Arrastrar lo aprobado a día y hora; «Distribuir» propone huecos; todo queda como propuesta.
- [ ] 3.5 Confirmar la propuesta → recién ahí se programa en Postiz (2.2).

## 4. Retroalimentación

- [ ] 4.1 Nota de voz en una pieza o placa (equipo y cliente): audio guardado + transcripción como comentario.
- [ ] 4.2 Tipo de cada comentario (texto, color, encuadre, tono, dato…) y marca «aplicado».
- [ ] 4.3 Lo corregido 3 veces en una marca → propuesta de regla aprendida (la aprueba el equipo; va a la ficha, `ver_marca`).
- [ ] 4.4 Métricas a 7 días por publicación, sumadas por ángulo en el reporte del mes.
