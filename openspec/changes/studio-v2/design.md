# studio-v2 — diseño

## 1. Secciones

| Sección | Qué hay | Hoy está en |
|---|---|---|
| **Marca** | Brand Kit (design system, tipografías, moodboards, avatares/casting, productos, voces), **plantillas**, biblioteca de contenido de la marca | Marcas, Contenido, Brand Kit |
| **Producción** | Pedidos/campañas en curso, tools (como acciones, no como menú), editor de video, Lab (sin marca) | Inicio, Campañas, Generar, Lab, Editor |
| **Entregas** | Lo listo para el cliente: piezas, estado (en revisión / aprobada / con cambios), comentarios | Portal |
| **Reportes** | Métricas por pieza y por canal (Postiz) | Performance (sin terminar) |
| **Ajustes** | Equipo, clientes y roles, integraciones | Ajustes |

Rutas viejas → redirect a su sección nueva (no se rompen links guardados).

## 2. Navegación: arriba

```
[coevo] [Geely ▾]   Marca   Producción   Entregas   Reportes            [⚙] [G]
─────────────────────────────────────────────────────────────────────────────
                     canvas a todo el ancho
```

- Con 5 secciones entra en una barra; libera el ancho para canvas y timeline (donde más se trabaja).
- **El selector de marca es lo primero** (diferencia con Higgsfield: Coevo es multimarca). Cambiar de marca
  cambia todo lo de abajo. "Sin marca" sólo existe en Lab.
- Dentro de cada sección, sub-navegación como pestañas (ej. Marca: Brand Kit · Plantillas · Biblioteca).
- Cliente: ve `Marca` (lectura + subir assets), `Entregas` y `Reportes`. No ve Producción ni Ajustes.
- Respeta las reglas vigentes: selectores al costado (`specs/workspace-layout`), nada escondido en
  desplegables de configuración.

## 3. Roles

Identidad: el mail que firma Cloudflare Access en el JWT (`services/access_guard.py` ya lo deja en
`scope.state.access_email`). La app no maneja contraseñas.

Tablas nuevas (Postgres, Alembic):

```
users        (id, email unique, name, role: admin|equipo|cliente, created_at, disabled_at)
memberships  (user_id, brand_id, can_approve bool)   -- sólo para clientes
```

- `admin`/`equipo`: todas las marcas. `admin` además gestiona usuarios.
- `cliente`: sólo las marcas de `memberships`. `can_approve` distingue "aprueba" de "sólo mira".
- Un mail que pasó Access pero no está en `users` → pantalla "pedí acceso a Coevo" (no ve nada).
- Alta de un cliente = fila en `users` + `memberships` **y** su mail en la policy de Access
  (una policy aparte, "Clientes", para no mezclar con "Equipo Coevo").
- Todo endpoint con `brand_id` verifica pertenencia en el backend, no sólo en la UI.
- Claude/scripts: token de servicio de Access → usuario técnico `claude@coevo` con rol `equipo`.

**Portal por link:** sigue funcionando hasta que cada cliente tenga cuenta; para eso sus rutas
(`/portal/*`, `/api/portal/*`) se abren por fuera de Access con el token como llave (`infra-v1`).
Después se apaga.

## 4. Producción con Claude (carruseles, video y lo que venga)

El patrón ya probado dos veces (video con `timeline.json`; carruseles con un documento editable en
claude.ai):

```
Studio (memoria de la marca) ──lee──▶ Claude (skill + design system + plantilla)
                                         │
                                         ▼
                              fuente editable (timeline.json / artboard HTML)
                                         │  una persona ajusta textos, orden, tomas
                                         ▼
Studio ◀──sube── piezas finales (PNG/MP4) + la fuente editable  →  Entregas
```

- **Studio no reimplementa el editor de cada formato.** La edición fina vive donde Claude la deja
  (artifact de claude.ai para piezas gráficas; el editor de Studio para video). Studio guarda, entrega y mide.
- Lo que sí es de Studio: la **memoria de la marca** (servida por API a las skills) y la **plantilla**.
- Se paga con la suscripción de Claude, no con la API (decisión vigente).

### Plantillas

```
template (id, brand_id | null = de Coevo, kind: carrusel|reel|story|ficha, name, version,
          source: html|timeline, slots: [{id, kind: texto|imagen|video, reglas}], preview_url)
```

- `brand_id = null` → plantilla base de Coevo (ej. "Carrusel V1" de `coevo-web`); cada marca la hereda
  con su design system aplicado o tiene las suyas.
- Una pieza producida guarda qué plantilla y versión usó → se puede regenerar igual.

## 5. Decisiones (2026-10-17, con Gonzalo)

1. **El cliente sólo comenta y aprueba.** No encarga trabajo desde Studio (se mantiene la regla de 2026-08).
2. **No hay canvas en Studio.** El canvas/editor de piezas gráficas es el de Claude (artifact HTML). Studio
   muestra la pieza terminada, junta comentarios por lámina y guarda la aprobación. El único editor propio
   que queda es el de video (ya existe).
3. **Reportes: resumen mensual armado por Coevo** (datos de Postiz + lectura con criterio), entregado como
   una Entrega más. Números en vivo para el cliente: después, si lo piden.

## 6. Para qué existe Studio (si se produce con Claude en local)

Claude en la Mac es **el taller**. Studio es **la casa de la marca y la vitrina para el cliente**: lo que el
taller no puede dar.

| Necesidad | Local con Claude | Studio |
|---|---|---|
| Producir y editar | ✅ (taller) | no |
| Memoria de la marca para cualquier persona, máquina o sesión | archivos sueltos | ✅ |
| Que el cliente vea, comente y apruebe con historial | un link por pieza, sin estado | ✅ |
| Qué se entregó, qué versión se aprobó, cuánto costó | se pierde | ✅ |
| Trabajos largos y pagos (video, generación), sin la Mac prendida | no | ✅ |
| Reportes mensuales por marca | no | ✅ |

Consecuencia: todo lo que en Studio sea "producir" se achica o se vuelve acción dentro de Producción;
lo que crece es Marca, Entregas y Reportes.

## 7. La memoria de la marca: hoy está en tres lugares

Relevado el 2026-10-18:

| Dónde | Qué guarda | Problema |
|---|---|---|
| Studio (`brands.json`, 13 marcas) | contexto, DNA, "design system" fotográfico, avatares, prendas, productos, fondos, moodboards, voces | Claude no lo puede leer; 13 categorías con "+ Add" sueltos; cada una usada por 2–9 marcas |
| `coevo-skills/identidades/` | avatares (Larisa, avatar-c…) con sus referencias | duplica a los avatares de Studio |
| cada repo de proyecto (`DESIGN.md`, `docs/clients/`) | identidad gráfica (logo, tipografías, colores, componentes), briefs, propuestas | no está en Studio; `reel-marca` pide "cargarlo del Brand Kit" y no puede |

**Qué hay de identidad gráfica en Studio (corregido 2026-10-18, revisando el código):** la tarjeta
"Design System" de BrandSettings guarda `brand.designSystem`, que el prompt de extracción define como
"sólo lo visual/fotográfico para guiar la generación de imágenes y video" (estilo, composición, color,
luz, casting, locaciones, dos/don'ts, motion). Lo gráfico está en otros campos: **colores** en
`dna.colors`, **tipografías** en `fonts` (nombres de Google Fonts, sin archivo ni licencia), **logos** en
Assets (casi vacío). Falta lo que las skills llaman design system (`DESIGN.md`: logo en archivo,
fuentes con licencia, tokens, componentes, reglas de layout). La propuesta junta todo lo gráfico en
**Identidad gráfica** y deja lo fotográfico en **Dirección de foto y video**.

Uso real del Brand Kit (marcas con dato / 13): contexto 9 · avatares 7 · fuentes 7 · DNA 7 ·
dirección de foto 7 · prendas 6 · negocio 6 · moodboards 5 · fondos 4 · voces 3 · productos 2 ·
fuentes de marca 1. Poses, logos y look & feel casi vacíos.

### Propuesta: seis bloques, un solo lugar

| Bloque | Qué entra | Reemplaza |
|---|---|---|
| **Quién es** | contexto, negocio, DNA, voz/tono | Brand DNA, Material |
| **Identidad gráfica** | logo, tipografías (archivo + licencia), colores, `DESIGN.md` | Logos, fuentes (nuevo: `DESIGN.md`) |
| **Dirección de foto y video** | estilo, luz, composición, casting, dos/don'ts, moodboards, fondos | "designSystem", Moodboard, Fondos, Look & Feel, Poses |
| **Caras** | avatares/modelos con sus referencias y voces | Avatars, Voces, `coevo-skills/identidades` |
| **Catálogo** | productos y prendas | Productos, Prendas, Accesorios |
| **Plantillas** | carrusel, reel, story… con su versión | (nuevo) |

### Onboarding: uno, no trece

En vez de 13 "+ Add": **"Cargar marca"** = pegar web/Instagram + soltar una carpeta (logo, fuentes,
fotos, PDF de marca). Claude (skill `onboarding-marca`) propone los seis bloques; una persona revisa y
aprueba bloque por bloque. Lo que falte queda marcado como faltante, no escondido.

## 8. Relación con `coevo-skills`

- **Skill = cómo** (método, criterio, pasos). **Studio = qué** (memoria de cada marca + circuito con el cliente).
- Regla: **una skill no guarda datos de una marca en su carpeta.** Los lee de Studio y devuelve lo que produce a Studio.
- El puente es el **MCP `coevo-studio`** (corre en la Mac, habla con la API con el token de servicio):
  `ver_marca`, `ver_plantilla`, `ver_comentarios`, `subir_entrega`, `marcar_resuelto`.
- `design-system` → guarda el `DESIGN.md` en Identidad gráfica. `reel-marca` / carruseles → leen Identidad
  gráfica + Plantillas. `generar-imagenes` → lee Dirección de foto + Caras (ya lee las poses de Studio).
- `identidades/` se muda a Caras de la marca correspondiente (Morph para Larisa/Keila).

## 9. Vista de carrusel (Entregas) y piloto

- Entregas muestra un carrusel como en el canvas de claude.ai: láminas en fila, zoom, comentario anclado
  a una lámina (y a un punto), aprobar. **Sólo ver y comentar**; editar sigue en Claude.
- Se guarda la fuente (HTML) junto a los PNG, así Claude corrige sobre la misma pieza.
- **Piloto:** los carruseles de Coevo × Morph hechos en `coevo-web` (Carrusel V1). Recorrido completo:
  Claude lee la marca por MCP → produce → `subir_entrega` → comentario en Studio → Claude lo lee y corrige.

## 10. "Agentes por rol" / la crew (2026-10-18)

Se evaluó cambiar la entrada de Studio por una "crew" (Productor, Casting, Vestuario, Foto, Cámara,
Voz, Montaje). **Decisión: la crew es una forma de contar, no una pantalla que haga falta.** No se
construye. Para el cliente alcanza "en producción / para revisar"; para nosotros, lo que hace falta es
la lista de **aprobaciones pendientes**. En contenido de Coevo puede aparecer como gráfico del video,
nunca como supuesta captura de Studio (`coevo-web/openspec/changes/video-hecho-con-studio`).

## 11. Qué ve el cliente (decidido 2026-10-19, con Gonzalo)

Todavía no se usa con clientes; esto define cómo va a ser cuando se use.

**Ve:** una barra mínima (su marca + su usuario) y
1. **Para revisar**: las entregas que esperan su respuesta (entra directo ahí).
2. **La pieza y sus láminas**: las dos vistas de Entregas, con Comentar · Pedir cambios · Aprobar.
3. **Aprobadas**: historial, con descarga.
4. **Mandar material**: sube fotos, logo, briefs; le llega al equipo (no edita el Brand Kit).
5. **Su Brand Kit en modo lectura**: para chequear que tenemos bien logo, colores, tipografías.
6. Después: **Reportes** (el resumen mensual llega como una entrega con PDF).

**No ve:** el menú de Studio ni las tools, costos, descartes, rondas ni comentarios internos, otras marcas.

**Dos pasos por entrega:** `interna` (el equipo revisa y comenta; Claude corrige) → **"Mandar al cliente"**
→ recién ahí la ve, sin los comentarios internos. Cada comentario guarda si es interno o del cliente.

**Quién aprueba:** se elige por persona (`memberships.can_approve`); el resto de la marca sólo comenta.

## 12. Material del cliente → Brand Kit (2026-10-19)

Prototipo: https://claude.ai/artifact/GKyzyZTpzo4fCZWWaErPYJ (pantallas "Cliente · Mandar material" y
"Equipo · Material que llegó").

1. **El cliente manda** (Mandar material): archivos o links (Pinterest, Drive, Instagram), con qué es
   (referencias/moodboard · productos · logo/tipografías · brief · otro) y una nota.
2. **Llega al equipo** en "Espera tu decisión". Claude propone a qué bloque va cada cosa y qué descartar
   (repetidas, baja resolución) y escribe "qué dice esto de la marca" (texto que lee al producir).
3. **Alguien del equipo confirma** → entra al bloque del Brand Kit, o queda "sólo para una pieza".
4. **El cliente lo ve** en Mi marca como «incorporado».

Nunca entra directo al Brand Kit: la memoria de la marca es lo que lee Claude, y curarla es parte del
servicio. Lo de una pieza puntual va como adjunto de un comentario en Entregas, no por acá.

## 13. Mucho material de golpe (2026-10-19)

No hay tope a lo que el cliente **manda**; sí a lo que **entra al Brand Kit**.
- Guardarlo es barato (800 fotos ≈ 1,5 GB ≈ centavos por mes en R2). Límites sólo técnicos por envío:
  ~100 archivos o ~500 MB; lo de más de 25 MB, por link. Cada imagen se guarda original + liviana.
- Claude agrupa antes de mostrar: saca repetidas y de baja calidad y arma grupos por estilo
  ("noche con flash 310 · estudio blanco 290 · exterior cálido 140 · 60 descartadas").
- El equipo decide **por grupo**; de cada grupo elegido Claude propone 8–12 representativas → bloque activo.
- El resto va al **archivo de la marca**: guardado y buscable, Claude no lo lee salvo que se le pida.
- Tope en el bloque activo (ej. ~20 referencias en Dirección de foto): para sumar una, sale otra.
- Al cliente: "Mandaste 800 imágenes · sumamos 24 a tu marca · el resto queda guardado".

## 14. Operación por rubro: un motor, una receta por rubro (2026-10-19)

Fuentes: `coevo-web/docs/rubros/concesionarias.md` (planes del 16/10) y `morph-site/src/constants/mensual.ts`
(packs de redes). **La oferta de Morph todavía no está cerrada**, y concesionarias no tiene clientes: por eso
Studio no escribe packs en el código; el plan de cada marca es un dato editable.

Ciclo común a los dos rubros (abono mensual con cupo de piezas):

| Cuándo | Qué pasa | En Studio |
|---|---|---|
| Una vez | Brand Kit + catálogo | Marca (6 bloques) |
| Cada mes | Plan del mes (piezas y ángulos), el cliente lo aprueba | **Plan con cupo** (nuevo) |
| Cada semana | El cliente manda material; producimos; aprueba en lote | **Material semanal por rubro** + **aprobación en lote** (nuevos) |
| Todos los días | Publicar, responder consultas | Postiz (`brand-integrations`) |
| Fin de mes | Reporte → plan siguiente | Reportes |

Lo que cambia por rubro (la "receta"):

| | Concesionaria | Marca de ropa (Morph) |
|---|---|---|
| Ítem del catálogo | Unidad: fotos del lote, modelo, año, km, precio, cuota | Prenda/producto: fotos, talles, link de compra |
| Material de cada semana | "Entró una unidad" · "bajó de precio" · preguntas de WhatsApp | "Llegó un producto/drop" · fotos de tienda · referencias |
| Piezas | Ficha en video, carrusel, presentador, historias | Video para pauta, video creativo, imágenes |

Nuevo para studio-v2:
1. **Plan del mes con cupo** como dato por marca: "Octubre: 6/10 unidades · 2/4 carruseles". Lo ve el cliente.
2. **Material semanal con formulario del rubro** (4 campos + fotos), que crea el ítem del catálogo y el pedido.
3. **Aprobación en lote**: las piezas de la semana una tras otra (la reunión semanal de una hora).
4. **Vista cliente pensada primero para celular** (el dueño manda la unidad desde el lote). Más adelante:
   recibir por WhatsApp.
5. **Costo y tiempo por pieza** para ver el margen de cada pack (ya hay costo de IA; falta el tiempo).

Orden: piloto con moda (hay material real); la receta de concesionarias se agrega cuando firme la primera.
