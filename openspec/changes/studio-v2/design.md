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

**Confusión de nombres:** en Studio, `designSystem` es la **dirección de foto** (estilo, luz, composición,
casting, dos/don'ts). En las skills, "design system" es la **identidad gráfica** (`DESIGN.md`: logo,
fuentes, colores, componentes). Son dos cosas distintas y hacen falta las dos.

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
