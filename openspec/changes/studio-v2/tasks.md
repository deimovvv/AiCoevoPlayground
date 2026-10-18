## 0. Revisión

- [ ] 0.1 Gonzalo revisa proposal + design y responde las 3 decisiones abiertas (design.md §5).
- [ ] 0.2 Al aprobarlo: entra a la tabla de activos (`changes/README.md`) cuando se libere un lugar.

## P. Piloto: el circuito con los carruseles de Coevo (primero)

- [ ] P.1 Token de servicio de Access (`infra-v1` 4.3) + usuario técnico para Claude.
- [ ] P.2 MCP `coevo-studio` (local): `ver_marca`, `ver_plantilla`, `ver_comentarios`, `subir_entrega`, `marcar_resuelto`.
- [ ] P.3 Tabla `deliveries` (pieza, láminas PNG, fuente HTML, estado, plantilla+versión) y `delivery_comments` (lámina, x/y, texto, estado).
- [ ] P.4 Entregas: vista de carrusel (fila, zoom, comentario anclado, aprobar).
- [ ] P.5 Recorrido completo con Carrusel V1 de `coevo-web`; anotar qué sobra y qué falta.

## M. Memoria de la marca (design.md §7)

- [ ] M.1 Brand Kit en seis bloques (sin perder datos: migración con backup).
- [ ] M.2 Identidad gráfica: logo, fuentes con licencia, colores, `DESIGN.md`.
- [ ] M.3 Skill `onboarding-marca` + botón "Cargar marca".
- [ ] M.4 Mudar `coevo-skills/identidades` a Caras; las skills leen por MCP (§8).

## 1. Roles (base de todo lo demás)

- [ ] 1.1 Tablas `users` y `memberships` + migración Alembic.
- [ ] 1.2 `current_user` en el backend a partir del mail del JWT de Access; mail desconocido → 403 "pedí acceso".
- [ ] 1.3 Filtro por marca en todo endpoint con `brand_id` (lista de marcas incluida).
- [ ] 1.4 Ajustes → Equipo y clientes: alta, rol, marcas, baja (admin).
- [ ] 1.5 Policy de Access "Clientes" separada de "Equipo Coevo"; guía en `docs/guias/produccion.md`.

## 2. Navegación

- [ ] 2.1 Barra superior con selector de marca y 5 secciones; sacar el sidebar.
- [ ] 2.2 Redirects de las rutas viejas.
- [ ] 2.3 Vista cliente: sólo Marca (lectura + subir), Entregas, Reportes.

## 3. Plantillas y Claude

- [ ] 3.1 Tabla `templates` + sección Marca → Plantillas.
- [ ] 3.2 API de memoria de marca para skills (design system, moodboards, avatares, plantillas) — requiere `infra-v1` 4.3.
- [ ] 3.3 Subir pieza + fuente editable a Entregas desde una skill. Primer caso: carruseles de `coevo-web`.

## 4. Entregas

- [ ] 4.1 Entregas por marca: estado, comentarios, aprobación (reusa notas del portal).
- [ ] 4.2 Migrar clientes del portal por link a cuentas; apagar el portal.
