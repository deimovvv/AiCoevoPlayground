## 0. Revisión

- [ ] 0.1 Gonzalo revisa proposal + design y responde las 3 decisiones abiertas (design.md §5).
- [ ] 0.2 Al aprobarlo: entra a la tabla de activos (`changes/README.md`) cuando se libere un lugar.

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
