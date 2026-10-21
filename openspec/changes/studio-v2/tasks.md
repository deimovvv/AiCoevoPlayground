## 0. Revisión

- [ ] 0.1 Gonzalo revisa proposal + design y responde las 3 decisiones abiertas (design.md §5).
- [ ] 0.2 Al aprobarlo: entra a la tabla de activos (`changes/README.md`) cuando se libere un lugar.

## P. Piloto: el circuito con los carruseles de Coevo (primero)

- [x] P.1 Token de servicio de Access (`infra-v1` 4.3) — anda (2026-10-18). Falta: usuario técnico cuando existan roles (1.x).
- [x] P.2 MCP `coevo-studio` (`mcp/coevo-studio/`, 2026-10-18): 10 herramientas de lectura + notas + proyectos de video, registrado en Claude Code (user). Faltan `ver_plantilla` (con M/3.1) y `subir_entrega` (con P.3).
- [x] P.3 Tablas `deliveries` + `delivery_comments` (migración `5b1e7c2d9a40`), `routers/deliveries.py`, archivos en `data/deliveries/<id>/r<ronda>/`; MCP: `ver_entregas`, `ver_entrega`, `subir_entrega`, `nueva_ronda`, `resolver_comentario` (2026-10-18).
- [x] P.4 `/dashboard/entregas`: láminas en fila, comentario anclado a un punto, rondas, pedir cambios / aprobar, subir desde la UI (2026-10-18). Falta: zoom de una lámina; videos sin salto (StaticFiles sin rangos).
- [ ] P.5 Recorrido completo con Carrusel V1 de `coevo-web`; anotar qué sobra y qué falta.

## M. Memoria de la marca (design.md §7)

- [~] M.1 Marca en bloques con edición en panel lateral (`BrandBlockEditor.tsx`, 2026-10-19): quién es, identidad (logo, colores, fuentes), dirección de foto (imágenes + reglas), caras, catálogo, y «Cargar material» con destino. Sobre los datos de siempre, sin migrar. Falta: plantillas, archivos de fuentes, DESIGN.md.
- [ ] M.2 Identidad gráfica: logo, fuentes con licencia, colores, `DESIGN.md`.
- [ ] M.3 Skill `onboarding-marca` + botón "Cargar marca".
- [ ] M.4 Mudar `coevo-skills/identidades` a Caras; las skills leen por MCP (§8).
- [ ] M.5 Un Design System de Claude Design por marca (pendiente, 2026-10-21). Lo arma Coevo con lo que pasa el cliente
      (manual, logo, fuentes, refs), vive en la cuenta de Coevo y se comparte con los operadores; el cliente nunca lo ve ni
      necesita Claude. Studio no diseña: guarda el link en Identidad y `ver_marca` lo devuelve. Carruseles/webs/posts se
      hacen en Claude Design con ese design system → Entregas. Primero con Coevo (ya hay carruseles) o ALGÜNA (manual en curso).
      Figma/Canva sólo si un cliente pide el editable.

## C. Campañas y material del cliente (design.md §15)

- [x] C.1 Tablero de campaña `/dashboard/tablero/:id` (tipo de input `plano`); columna Campañas en Producción (2026-10-19).
- [x] C.2 «Cargar material» pregunta «¿para qué es?» (marca o campaña).
- [x] C.3 `inbox_items` (migración `b4f1c8d2e6a3`), `routers/inbox.py`: el cliente manda archivos / link / nota sin elegir tipos;
      el equipo ordena en `/dashboard/bandeja` (a la marca o a una campaña, tipo por imagen, descartar); el cliente ve el estado.
- [x] C.4 El agente propone destino (marca o proyecto) y tipo de cada imagen, y cuál descartar (`services/inbox_agent.py`, `inbox_items.proposal`, migración `e1a4c9b2f7d3`, 2026-10-21): corre solo al llegar material; en la Bandeja queda elegido con el porqué; el equipo confirma. Nunca incorpora solo. **Falta: que Gonzalo lo pruebe con un envío real.**
- [~] C.5 Avisos por mail (`services/mailer.py`, Resend, 2026-10-20): invitación, «para revisar», el cliente aprobó / pidió cambios / comentó (agrupados), mandó material, lo sumamos. Falta: dominio verificado + `RESEND_API_KEY` en el servidor.

## O. Operación mensual (design.md §14)

- [ ] O.1 Plan del mes por marca como dato (piezas por tipo + cupo), visible para el cliente.
- [ ] O.2 Material semanal con formulario por rubro (moda primero; concesionaria al firmar la primera).
- [ ] O.3 Aprobación en lote (las piezas de la semana).
- [ ] O.4 Tiempo por pieza, junto al costo de IA → margen por pack.
- [ ] O.5 Material masivo: agrupar, archivo de la marca, tope del bloque activo (design.md §13).

- [ ] O.6 Postiz (pendiente, 2026-10-21: nube, plan Team; se prende con el primer cliente o proyecto que lo use). API verificada:
      `api.postiz.com/public/v1` — `GET /integrations`, `POST /upload`, `POST /posts` (now/schedule), `GET /analytics/{id}?date=7|30|90`.
      Canales por marca en Marca; «Publicar» en una entrega aprobada (sólo las láminas aprobadas); métricas del mes → reporte.

- [x] O.7 Semáforo + ficha comercial (2026-10-21, sólo admin): `/dashboard/semaforo` (`routers/semaforo.py`): una fila por marca con color y porqué
      (cambios pedidos, material sin ordenar, espera al cliente, sin mandar, margen, piezas contra el pack). Ficha: fee, moneda, pack, contacto,
      facturación en `data/commercial.json` (fuera de git y fuera de brands.json: el cliente nunca la ve). Margen = fee − costo de IA del mes.
- [ ] O.8 Interesados de la pauta (pendiente, antes de pautar): formulario de la web → planilla o Notion; quién responde y en cuánto.
      CRM (HubSpot gratis) recién con muchas consultas por semana. No va en Studio.

## 1. Roles (base de todo lo demás)

- [x] 1.1 Tablas `users` y `memberships` (migración `9d2e4b7a1c08`).
- [x] 1.2 `services/roles.py` (RoleGuard): rol desde el mail de Access; `ADMIN_EMAILS` crea admins; desconocido → "pedí acceso"; cliente con lista cerrada de rutas.
- [~] 1.3 Filtro por marca: marcas, entregas y comentarios. Los /static no se filtran por marca (nombres al azar; revisar al mudar a R2).
- [x] 1.4 `/dashboard/accesos` (admin): alta, rol, marcas, quién aprueba, baja (2026-10-19).
- [x] 1.6 El cliente suma a su equipo (2026-10-20): `memberships.can_invite` (migración `d8f3b1a7c2e9`), Accesos → «suma gente»; `/cliente/personas` (Equipo): el contacto principal invita (comenta o aprueba) y saca; no saca a otro principal ni a sí mismo, ni reactiva bajas; al equipo le llega un mail.
- [ ] 1.5 Policy de Access "Clientes" separada de "Equipo Coevo"; guía en `docs/guias/produccion.md`.

## 2. Navegación

- [x] 2.1 Barra superior (`TopBar.tsx`) con selector de marca y 4 secciones; sidebar fuera; tema papel + Geist por defecto; `/dashboard` → Marca (6 bloques, `MarcaPage.tsx`); Producción (`ProduccionPage.tsx`) (2026-10-19).
- [ ] 2.2 Redirects de las rutas viejas.
- [ ] 2.3 Vista cliente: sólo Marca (lectura + subir), Entregas, Reportes.

## 3. Plantillas y Claude

- [ ] 3.1 Tabla `templates` + sección Marca → Plantillas.
- [ ] 3.2 API de memoria de marca para skills (design system, moodboards, avatares, plantillas) — requiere `infra-v1` 4.3.
- [ ] 3.3 Subir pieza + fuente editable a Entregas desde una skill. Primer caso: carruseles de `coevo-web`.

## 4. Entregas

- [x] 4.0 Dos pasos: `deliveries.visibility` + `sent_at`, `delivery_comments.internal` (migración `7c3a9e1f2b55`); equipo: Pedir otra vuelta · Mandar al cliente · Marcar aprobada; una ronda nueva vuelve a interna (2026-10-19).
- [~] 4.0b Vista cliente en `/cliente` (hoy vista previa del equipo): Entregas (Para revisar · Aprobadas) y Mi marca en lectura. Faltan: descarga de aprobadas, Mandar material, entrar como cliente (roles).

- [ ] 4.1 Entregas por marca: estado, comentarios, aprobación (reusa notas del portal).
- [ ] 4.2 Migrar clientes del portal por link a cuentas; apagar el portal.
