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

## 5. Decisiones abiertas

1. ¿El cliente puede **pedir** desde Studio (no sólo comentar)? Hoy la regla es "deja notas, no encarga".
2. ¿Los carruseles se editan siempre en claude.ai, o cuando se repitan mucho se hace un editor en Studio?
   Propuesta: claude.ai hasta que duela.
3. Reportes: ¿los ve el cliente en vivo o sólo un resumen mensual armado por nosotros?
