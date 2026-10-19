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

- [ ] M.1 Brand Kit en seis bloques (sin perder datos: migración con backup).
- [ ] M.2 Identidad gráfica: logo, fuentes con licencia, colores, `DESIGN.md`.
- [ ] M.3 Skill `onboarding-marca` + botón "Cargar marca".
- [ ] M.4 Mudar `coevo-skills/identidades` a Caras; las skills leen por MCP (§8).

## O. Operación mensual (design.md §14)

- [ ] O.1 Plan del mes por marca como dato (piezas por tipo + cupo), visible para el cliente.
- [ ] O.2 Material semanal con formulario por rubro (moda primero; concesionaria al firmar la primera).
- [ ] O.3 Aprobación en lote (las piezas de la semana).
- [ ] O.4 Tiempo por pieza, junto al costo de IA → margen por pack.
- [ ] O.5 Material masivo: agrupar, archivo de la marca, tope del bloque activo (design.md §13).

## 1. Roles (base de todo lo demás)

- [x] 1.1 Tablas `users` y `memberships` (migración `9d2e4b7a1c08`).
- [x] 1.2 `services/roles.py` (RoleGuard): rol desde el mail de Access; `ADMIN_EMAILS` crea admins; desconocido → "pedí acceso"; cliente con lista cerrada de rutas.
- [~] 1.3 Filtro por marca: marcas, entregas y comentarios. Los /static no se filtran por marca (nombres al azar; revisar al mudar a R2).
- [x] 1.4 `/dashboard/accesos` (admin): alta, rol, marcas, quién aprueba, baja (2026-10-19).
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
