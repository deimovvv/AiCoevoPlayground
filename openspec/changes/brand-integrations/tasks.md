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

- [x] 3.1 Estados de pieza en Entregas: en desarrollo, por revisar, lista, en Postiz, publicada, pausada, descartada. Hecho (2026-10-31): la fase (`phase`, sale de visibilidad + estado + `publish_state`), pausar/descartar (`POST /api/deliveries/{id}/plan`), la fase a la vista en la entrega. Tablero por fases en `/dashboard/entregas/plan` (2026-10-31).
- [x] 3.2 Cada entrega lleva su ángulo (de `strategy.angles`); el MCP `subir_entrega` lo acepta y `planificar_entrega` lo cambia (2026-10-31). En la entrega se elige de la lista de ángulos de la estrategia.
- [x] 3.3 Vista semana y mes por marca, con el ángulo del mes según `strategy.calendar` y cuántas piezas lleva cada ángulo (2026-10-31, `pages/PlanPage.tsx`).
- [x] 3.4 Arrastrar a un día (lo no aprobado queda punteado, tentativo), elegir hora y **redes** (Instagram, TikTok, LinkedIn, YouTube, Facebook, X, Threads) en el Plan o en la entrega, y «Distribuir»: lo aprobado sin fecha a los días hábiles libres, primero lo del ángulo del mes (2026-10-31).
- [~] 3.5 Confirmar la propuesta → recién ahí se programa en Postiz (2.2). **Interfaz hecha (2026-10-31):** «Confirmar la semana / el mes» en el Plan, con el resumen (qué sale, cuándo, dónde, y qué no está listo: sin aprobar, sin red, sin ángulo) y `POST /api/brands/{id}/plan/confirm`. **Pendiente:** sin `POSTIZ_API_KEY` responde `pending: "postiz"` y no cambia nada; falta mandar los posts (2.1–2.2).

## 4. Retroalimentación

- [x] 4.1 Nota de voz en una pieza o placa (equipo y cliente): audio guardado + transcripción como comentario (2026-10-31, `POST …/comments/audio`, Gemini de Coevo; si falla, queda el audio).
- [x] 4.2 Tipo de cada comentario (texto, color, encuadre, tono, dato, imagen, otro): la nota de voz llega clasificada; MCP `clasificar_comentario`. «Aplicado» = resuelto (2026-10-31).
- [x] 4.3 Lo corregido 3 veces en una marca → propuesta de regla aprendida (la aprueba el equipo; va a la ficha, `ver_marca` → `reglas_aprendidas`). Hecho (2026-10-31): Plan → Aprendizaje (correcciones por tipo, candidatos con ejemplos, «Hacer regla», reglas de la marca) y `GET /api/brands/{id}/aprendizaje`.
- [~] 4.4 Métricas a 7 días por publicación, sumadas por ángulo en el reporte del mes. Hecho: por ángulo, piezas, «a la primera» y vueltas promedio. **Pendiente (Postiz):** alcance, guardados y compartidos (la columna ya está, con «—»).

## 5. Pendiente — cuando esté Postiz (2026-10-31, Gonzalo: «después vemos lo de las skills, la cuenta y la API»)

- [ ] 5.1 Cuenta de Postiz (nube) con la marca Coevo y sus redes conectadas; `POSTIZ_API_KEY` en `backend/.env` del servidor (la guarda Gonzalo).
- [ ] 5.2 `confirm_plan`: subir láminas (`POST /upload`) y crear los posts (`POST /posts`, schedule) por red; guardar el id de Postiz y pasar a `en_postiz`.
- [ ] 5.3 Sincronizar: lo publicado → `publicada` + `published_at`; métricas a 7 días → columna «Alcance» de Aprendizaje y reporte del mes.
- [ ] 5.4 Skills: `carrusel` (y las demás) eligen el ángulo antes del guion (`ver_marca` → estrategia), suben con `angulo`, respetan `reglas_aprendidas` y clasifican los comentarios escritos que leen.
