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
- [~] M.5 Un Design System de Claude Design por marca (2026-10-21; ALGÜNA hecho el 2026-10-23: https://claude.ai/artifact/2MFXakLjjF3e992iLZJitq, desde el manual ALGÜNA + FH). Studio: `brand.designSystemUrl` (Marca → Identidad), `ver_marca` lo devuelve con cómo usarlo. Lo arma Coevo con lo que pasa el cliente
      (manual, logo, fuentes, refs), vive en la cuenta de Coevo y se comparte con los operadores; el cliente nunca lo ve ni
      necesita Claude. Studio no diseña: guarda el link en Identidad y `ver_marca` lo devuelve. Carruseles/webs/posts se
      hacen en Claude Design con ese design system → Entregas. Primero con Coevo (ya hay carruseles) o ALGÜNA (manual en curso).
      Figma/Canva sólo si un cliente pide el editable.

- [x] M.6 Referencias de afuera (2026-10-22): link de un tablero de Pinterest → moodboard (o luz, o locación) con nombre, en la marca o en
      un proyecto (`routers/importar.py`, feed público del tablero: últimos 25 pines, 736 px). Las imágenes quedan con `board` y `source`:
      en Marca se agrupan por tablero. «Elegir» y quitar varias en todas las grillas.
- [x] M.9 PDF de marca (2026-10-24): se sube por Mandar material o «Subir un PDF de marca» en la Bandeja; se parte en páginas
      (PyMuPDF, `services/pdf_pages.py`, hasta 40) y el agente clasifica cada una (tipos nuevos «manual» y «carrusel») y lee la
      identidad (colores, tipografías, tono, siempre/nunca). «Pasar a Marca como propuesta» sólo llena lo vacío y marca «propuesto».
      Páginas del manual en Identidad; referencias de carrusel en Dirección de foto y Plantillas; el MCP las devuelve.
- [x] M.10 Archivos de trabajo (2026-10-25): Marca → «Archivos» guarda los links de cada marca (piezas, exploraciones,
  manual, design system) con «lo ve el cliente»; el cliente recibe sólo los marcados (`_brand_for` en main.py); el MCP los
  da en `identidad_grafica.archivos_de_trabajo` con la regla de sumar piezas al archivo «piezas», no abrir uno nuevo.
- [ ] M.11 PDF de marca, v2: guardarlo entero como «Manual de marca», leer la identidad y sacar páginas como referencia
  sólo si se elige (hoy se parte en páginas y pregunta una por una). «Juntar en un tablero» para unificar moodboards.
- [ ] M.12 Instructivos: «¿Cómo funciona?» por sección (Marca, Bandeja, Entregas, Archivos) + página de ayuda del
- [ ] M.13 Reglas de marca que se chequean solas (2026-10-27, de NORA: «el 95 % de los malos resultados venía de datos de marca
      flojos, no del modelo»). En Marca, un bloque «Reglas» como dato: **nunca** (colores, palabras, cosas que no van), **siempre**
      (cómo se escribe el nombre, español rioplatense o neutro), con ejemplo de cada una. `ver_marca` las devuelve y las skills las
      leen antes de generar. Chequeo en dos tiempos: (1) antes de gastar, el pedido/prompt contra las reglas (texto, gratis); (2) después,
      el texto de la pieza (OCR con Gemini) contra las reglas, como aviso en Entregas, no bloqueo. Arrancar con 2–3 marcas reales.
  circuito completo + videos cortos (skill explicar-herramienta) cuando las pantallas estén quietas.
- [ ] M.14 Marca: primero lo que **es** la marca, después las imágenes (Gonzalo, 2026-10-28: «ves como pura otras imágenes»).
      Hoy 4 de 5 bloques de la derecha son grillas de fotos y «Quién es» queda en un cuadro chico; con una concesionaria o una
      clínica se ve peor, y los nombres son de moda («prendas», «Poses de catálogo»). Propuesta: (1) arriba, en texto, Quién es ·
      Cómo habla (tono, siempre/nunca) · Reglas (M.13) · Objetivos y línea base; (2) las imágenes juntas en un bloque «Cómo se ve»
      más chico, con «ver todo»; (3) «Catálogo» → «Productos o servicios»; (4) el «3 de 6» pasa a ser **la lista del arranque**
      (`docs/negocio/onboarding-cliente.md`: identidad, reglas, productos, persona, quién aprueba, accesos, línea base, pilotos),
      el cliente ve lo suyo. Antes de diseñar: mirar 2–3 referencias (Frontify, Brandfolder, páginas de marca de Notion).
      Va con la rama de UX de Facu.
- [ ] M.7 Catálogo desde una carpeta de Drive compartida (necesita habilitar la API de Drive en el proyecto de Google de Coevo).
- [ ] M.8 Curar la memoria: de dónde vino cada imagen (web, Instagram, cliente, Coevo) y para qué la usa Claude en cada bloque.

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

- [ ] O.6 Postiz (pendiente, 2026-10-21: nube, plan Team; primera prueba con la marca Coevo, después el primer cliente que publique con Coevo). API verificada:
      `api.postiz.com/public/v1` — `GET /integrations`, `POST /upload`, `POST /posts` (now/schedule), `GET /analytics/{id}?date=7|30|90`.
      Canales por marca en Marca; «Publicar» en una entrega aprobada (sólo las láminas aprobadas); métricas del mes → reporte.

- [x] O.7 «Resumen» (semáforo) + ficha comercial (2026-10-21, sólo admin): `/dashboard/clientes` (`routers/semaforo.py`): una fila por marca con color y porqué
      (cambios pedidos, material sin ordenar, espera al cliente, sin mandar, margen, piezas contra el pack). Ficha: fee, moneda, pack, contacto,
      facturación en `data/commercial.json` (fuera de git y fuera de brands.json: el cliente nunca la ve). Margen = fee − costo de IA del mes.
- [x] O.9 Reporte del mes (2026-10-22, `routers/reportes.py`, `/dashboard/reporte` y `/cliente/reporte`): producción (mandadas, aprobadas,
      a la primera, con cambios, días hasta aprobar, por proyecto) + la lectura de Coevo; se publica y recién ahí lo ve el cliente.
      Resultados en redes: lugar reservado para Postiz (O.6). Sin costos de IA (son de Coevo).
- [x] O.10 Proyectos plegables en Entregas, con cuántas piezas y aprobadas (2026-10-22). Falta, con el primer catálogo grande: grilla del
      proyecto (hoja de contactos con filtros) y la ficha por producto (SKU con sus tomas, aprobación por ficha, ZIP con nombres de la tienda).
- [ ] O.11 Pauta en el reporte (pendiente, 2026-10-24; no se aborda todavía). Primero a mano: sección «Pauta» del reporte con
      invertido, alcance, consultas y costo por consulta (cargados o desde el CSV del Administrador de anuncios). Automático con la API
      de anuncios de Meta (app + usuario del sistema con lectura) recién si se pauta seguido para varias marcas. Meta: un portafolio,
      una cuenta publicitaria por marca (Coevo, Morph).
- [ ] O.8 Interesados de la pauta (pendiente, antes de pautar): formulario de la web → planilla o Notion; quién responde y en cuánto.
      CRM (HubSpot gratis) recién con muchas consultas por semana. No va en Studio.
- [ ] O.12 Números de Coevo (2026-10-27, sólo admin; de NORA, que muestra «aprobado a la primera» con fuente). El reporte del mes (O.9)
      ya calcula a la primera / con cambios / días por marca: juntarlo para todas las marcas y por mes, **por tipo de pieza** (`kind`:
      carrusel · video · imágenes) y con tendencia: mandadas, aprobadas, % a la primera, rondas promedio, días hasta aprobar, volumen, y
      **costo de IA por pieza aprobada** (costo del mes de `generations` / aprobadas; aproximado hasta O.4). Es la fuente de las cifras
      para propuestas y la web («X piezas en 30 días, Y % aprobadas a la primera»). Primero de los tres: los datos ya están.
      Orden acordado: O.12 → M.13 → O.6 (publicar y medir en el portal; necesita el plan de Postiz y la primera marca que publique con Coevo).

## 1. Roles (base de todo lo demás)

- [x] 1.1 Tablas `users` y `memberships` (migración `9d2e4b7a1c08`).
- [x] 1.2 `services/roles.py` (RoleGuard): rol desde el mail de Access; `ADMIN_EMAILS` crea admins; desconocido → "pedí acceso"; cliente con lista cerrada de rutas.
- [~] 1.3 Filtro por marca: marcas, entregas y comentarios. Los /static no se filtran por marca (nombres al azar; revisar al mudar a R2).
- [x] 1.4 `/dashboard/accesos` (admin): alta, rol, marcas, quién aprueba, baja (2026-10-19).
- [x] 1.6 El cliente suma a su equipo (2026-10-20): `memberships.can_invite` (migración `d8f3b1a7c2e9`), Accesos → «suma gente»; `/cliente/personas` (Equipo): el contacto principal invita (comenta o aprueba) y saca; no saca a otro principal ni a sí mismo, ni reactiva bajas; al equipo le llega un mail.
- [ ] 1.7 Login propio (pendiente, depende de Resend): pantalla de entrada con la estética de la puerta, «Entrar con Google» y
      «Entrar con tu mail» (código por Resend). Cloudflare sigue delante del servidor pero el cliente no ve su pantalla.
      Hoy: login de Cloudflare con logo, color y textos de Coevo (2026-10-22).
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
- [~] 4.0b Vista cliente en `/cliente` (hoy vista previa del equipo): Entregas (Para revisar · Aprobadas) y Mi marca en lectura. Faltan: Mandar material, entrar como cliente (roles).

- [x] 4.3 Entregas en uso real (2026-10-22, pedido con Koxis): renombrar la entrega; «+ Proyecto» visible y borrar proyecto (sus entregas
      quedan sin proyecto); etapas sugeridas Carrusel / Historias / Video; «Sumar láminas» y sacar una lámina (equipo); el cliente
      «Cambiar mi elección» después de aprobar; «¿Cómo funciona?» para el cliente (se abre la primera vez). Falta: video del recorrido.
      Después (2026-10-22): el punto muestra su nota al pasar el mouse; borrar comentarios (el cliente, sólo los suyos); «+ Proyecto» sólo como
      opción del desplegable; «Sumar lámina» como tarjeta al final de la fila; zoom con scroll tipo Canva (con más de 4 láminas arranca al 70%).
- [x] 4.4 «Descargar aprobadas» (hecho 2026-10-26: botón «Descargar» en la entrega aprobada, ícono por proyecto, «Bajar todo» del cliente; probado con Koxis, 15 piezas) (2026-10-26, pedido de Keyla: a Koxis se le terminó pasando un Drive aparte): zip por proyecto
      o etapa con los originales (video con transparencia) y nombres `Marca_Proyecto_vN_03.ext`. Para el equipo y el cliente.
- [ ] 4.5 Drive del cliente: una carpeta general por marca (la pone el cliente, nos da permiso de edición); al aprobar una pieza,
      Studio crea solo `Proyecto / Etapa / vN` y copia el original. Un sentido: Studio → Drive. Verificar antes: API de Drive en el
      proyecto de Google de Coevo (sirve también para M.7) y de quién es el espacio que ocupan los archivos subidos.
- [ ] 4.1 Entregas por marca: estado, comentarios, aprobación (reusa notas del portal).
- [ ] 4.2 Migrar clientes del portal por link a cuentas; apagar el portal.
