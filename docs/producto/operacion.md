# Cómo opera Coevo: de la marca a la pieza publicada

**Qué es este documento:** el mapa completo de cómo trabaja Coevo con una marca: quién hace qué, en qué
orden, con qué herramientas y dónde queda cada cosa. Es la base para explicarlo (al equipo, a un cliente,
en un video). Lo que cambie se cambia acá.

**Estado:** borrador vivo, armado el 2026-10-30 con Gonzalo. Las partes marcadas **por hacer** todavía no existen.

**Caso que lo prueba:** Mi Saluteca (app de historial médico). Su estrategia está en
`MiSaluteca-app/docs/spec-campana-mi-saluteca.md` y su design system en `MiSaluteca-app/docs/design/`.

---

## 1. La idea en una frase

**Coevo guarda la memoria de cada marca y la usa para producir su contenido cada semana: las personas
ponen el criterio, las skills producen y la marca aprueba.**

Tesis de fondo (de `coevo-web`): *lo que es regla lo hace el sistema; lo que es criterio lo hace la casa.*

## 2. Las cuatro piezas

| Pieza | Qué es | Qué hace |
|---|---|---|
| **El equipo** | las personas de Coevo | pone el criterio: estrategia, gusto, decisiones |
| **Las skills** (`coevo-skills`) | recetas que ejecuta Claude | producen: carruseles, reels, fichas, estrategia |
| **Coevo Studio** (`app.coevoagency.com`) | la casa de cada marca, en la nube | recuerda, muestra y registra |
| **La marca** (el cliente) | quien contrata | dice, aprueba, firma lo legal |

## 3. Los roles (son funciones, no personas)

Hoy una misma persona cumple varios roles. Mañana pueden ser personas distintas. Coevo es una empresa:
los roles no dependen de quién esté.

| Rol | Qué decide | Qué hace en el día a día |
|---|---|---|
| **Dirección** | la estrategia y los ángulos; aprueba el design system; define qué se ofrece | arma o revisa el spec de campaña; está en la reunión con la marca |
| **Operación** | qué se produce esta semana y qué se le manda a la marca | dispara las skills, revisa los borradores, sube a Entregas, publica |
| **Sistema** | nada: ejecuta reglas | produce borradores leyendo la memoria de la marca; registra costo y vueltas |
| **Marca** | qué aprueba y qué no | comenta en Studio, aprueba, firma lo legal |

**Lo que nunca se automatiza:** mandarle la pieza a la marca, publicar, las frases legales (en salud,
la privacidad) y usar personas reales (necesitan permiso escrito).

## 4. Las tres palabras que se mezclaban

| Palabra | Qué es | Ejemplo |
|---|---|---|
| **Formato** | lo que la marca **compra y recibe** | un carrusel, un reel explicativo |
| **Skill** | **cómo se hace** (la receta) | `carrusel`, `reels-explicativos` |
| **Tool de Studio** | una pantalla, sólo si alguien tiene que operar sin terminal | Fashion Reel, Ecommerce Pack |

**Se vende un formato, se produce con una skill.** Hay skills que no son formatos: ordenar archivos,
filmar una app para usarla adentro de otra pieza (`grabar-web`), leer imágenes.

Los formatos **no están cerrados**: se curan a medida que entran clientes reales. Punto de partida:
carrusel, reel explicativo dibujado, reel de marca, reel con persona hablando; en moda, fichas de
e-commerce y video catálogo. Un formato se suma cuando ya se hizo con una skill para tres marcas
distintas o cuando lo pide un cliente que paga.

## 5. El mapa

```
                       ┌───────────────── LA MARCA ─────────────────┐
                       │ dice (reunión) · aprueba · firma lo legal   │
                       └────────┬──────────────────────▲────────────┘
                     reunión    │                      │ aprueba o comenta
                                ▼                      │ (Studio → Entregas)
  ① ENTRADA (una vez,        ② CADA SEMANA                       ③ CADA MES
     y cada trimestre)
  ─────────────────────      ────────────────────────────        ─────────────────────
  auditoría                  pedidos = calendario de la          comentarios por tipo
  → mapa de mercado          estrategia + novedades del          + métricas a 7 días
  → spec de campaña          producto + lo dicho en la reunión   → reglas nuevas
  + design system                                                → ángulos ajustados
          │                              │                                │
          ▼                              ▼                                ▼
  ┌──────────────────── COEVO STUDIO · la memoria de la marca ─────────────────────────┐
  │ quién es y su voz · identidad (colores, letras, logos, link al design system)       │
  │ ESTRATEGIA: claim, enemigo, ángulos, calendario   (ver_marca → estrategia)          │
  │ REGLAS APRENDIDAS: lo que se corrigió tres veces  (por hacer)                       │
  │ Entregas (rondas, comentarios, aprobación) · costo por pieza                        │
  └──────────────────────────────┬───────────────────────────────────▲─────────────────┘
                                 │ leen antes de producir             │ suben borradores
                                 ▼                                    │
                 LAS SKILLS: /carrusel · /reels-explicativos · /reel-marca · …
          las dispara Operación (modo persona) o una rutina semanal (modo sistema)
```

## 6. Ciclo ① — La entrada de una marca

Pasa una vez, y se revisa cada trimestre.

| Paso | Skill | Qué sale | Quién aprueba |
|---|---|---|---|
| Auditoría desde afuera | `auditoria-creativa` | lo que la marca dice contra lo que hace; la tensión en una frase | Dirección |
| Mercado | `mapa-de-mercado` | competencia, el hueco, referencias | Dirección |
| Estrategia | `spec-campana` | claim, enemigo, seis burbujas de contenido, calendario, qué se automatiza | Dirección y la marca |
| Identidad | `design-system` | colores, letras, logo, reglas de imagen, piezas tipo | la marca |
| Carga en Studio | (a mano hoy) | la ficha completa | Operación |

**De dónde sale el design system:** lo generamos nosotros (`design-system`) a partir de lo que la marca ya
tiene, sea su web, su manual o sus piezas, y **la marca lo aprueba**, porque es su identidad.
- Si la web es nuestra (Mi Saluteca, ALGÜNA), **vive en el código de la web**: el `DESIGN.md` y los tokens
  del repo. Si la web cambia, las piezas cambian con ella.
- Si la web no es nuestra, vive en Claude Design.
- **Studio no guarda una copia: guarda el link.** Las skills lo leen siempre antes de producir.

El design system de Mi Saluteca («Carpeta») ya decidió la estética: interfaz real con datos ficticios,
papel real (sobres, la carpeta del placard, la mesa de la cocina) y dibujo de cuaderno. Nunca médicos ni
pacientes generados, candados, escudos ni azul hospital.

## 7. Ciclo ② — La semana

| Paso | Rol | Qué pasa | Dónde queda |
|---|---|---|---|
| **Reunión** (45 min) | Dirección + la marca | el sistema prepara la agenda (lo entregado, lo pendiente, lo que costó); después ordena lo dicho | la estrategia en Studio (skill `reunion`, **por hacer**) |
| **Plan** | Operación | qué piezas salen, según el calendario de la estrategia | un proyecto en Studio |
| **Producir** | Sistema | cada skill lee la ficha, la estrategia y el design system, y arma un borrador | `~/cov/archivos/<marca>/` |
| **Revisión interna** | Operación | mira, corrige, aprueba el borrador | idem |
| **Entrega** | Operación | sube la pieza; queda interna hasta que se decide mandarla | Studio → Entregas |
| **Aprobación** | la marca | aprueba o comenta placa por placa | Studio; el sistema anota vueltas y tipo de corrección |
| **Publicar** | Operación | programa lo aprobado | Postiz (**por conectar**) |

**Cómo se responde a lo que dice la marca:** lo que dice en la reunión **no se convierte directo en una
pieza: ajusta un ángulo**, y las piezas salen de los ángulos. Si la marca pide «algo de la vuelta a
clases», eso se vuelve una burbuja del calendario que produce varias piezas coherentes, no un post suelto.

## 8. Ciclo ③ — El mes

- **Informe:** piezas, vueltas hasta la aprobación, costo, y alcance, guardados y compartidos a los 7 días.
- **Lo que se corrigió tres veces se vuelve regla** de la marca en Studio. Cada comentario se clasifica por
  tipo (texto, color, encuadre, tono…). A NORA, el 69 % era texto, y por eso su control empieza por ahí.
- **Los ángulos se ajustan** con lo que funcionó y lo que no.

## 9. Dos modos de operar una marca

| | **Modo persona** | **Modo sistema** |
|---|---|---|
| Quién dispara una pieza | Operación le pide a Claude («hacé un carrusel para…») | una rutina semanal, desde el calendario y los ángulos |
| Qué decide el equipo | cada guion y cada gasto | los ángulos y la estrategia; después revisa |
| Subida a Studio | a mano, con OK | automática, como interna |
| Para qué marcas | las que recién entran, o donde cada pieza es distinta | las que ya tienen ficha completa, ángulos y formatos probados |

Una marca **empieza** en modo persona y **pasa** a modo sistema cuando su ficha y sus formatos están
probados (muchas piezas aprobadas a la primera). Se automatiza lo que ya se hizo a mano varias veces.

## 10. Dónde vive cada cosa

| Cosa | Hogar | Los demás lugares… |
|---|---|---|
| Cómo se hace (recetas) | `coevo-skills` (git) | — |
| Quién es la marca, su identidad, su estrategia, lo aprendido | **Coevo Studio** | las skills la leen |
| El design system | el repo de la web, o Claude Design | Studio guarda el link |
| El trabajo en curso | `~/cov/archivos/<marca>/` | — |
| Lo terminado y aprobado | Studio → Entregas | — |
| Lo que escriben personas para personas (actas, calendario) | Notion | — |

Regla de `coevo-skills/SISTEMA.md`: **cada cosa tiene un solo hogar; los demás guardan el link.**

## 11. Lo que falta, en orden

| # | Qué | Para qué |
|---|---|---|
| 1 | ~~Bloque «Estrategia» en la ficha de Studio~~ **hecho 2026-10-30** (`changes/brand-strategy`; falta la pantalla y que `carrusel` elija el ángulo) | que las skills produzcan respondiendo a un ángulo, no piezas sueltas. **Es la palanca** |
| 2 | **Skill `reunion`** (preparar la agenda y ordenar lo dicho) | que lo que dice la marca vuelva a los ángulos |
| 3 | **Que el MCP pueda escribir la ficha**, con aprobación | cargar lo aprendido sin hacerlo a mano |
| 4 | **Studio acepta el link de un repo como design system** (hoy sólo claude.ai) | marcas cuya web es nuestra |
| 5 | **Publicar y medir** (Postiz) | sin números a 7 días no hay informe |
| 6 | **Vueltas y costo visibles en Entregas** | el «a la primera» medido de verdad |

## 12. Cómo contarlo en un video (guion sugerido)

Siete escenas, cada una con algo real para mostrar. La skill `explicar-herramienta` arma el video con locución
y una página que se scrollea, usando la app de verdad.

1. **El problema.** Una marca mediana necesita contenido todas las semanas y no tiene un equipo para hacerlo.
2. **La memoria de la marca.** La ficha de Mi Saluteca en Studio: quién es, su voz, sus colores, su estrategia.
3. **La estrategia.** El claim, el enemigo y las burbujas, en una sola pantalla.
4. **La producción.** Una skill arma un carrusel leyendo esa memoria. El costo, a la vista.
5. **La entrega.** El carrusel en Studio; la marca comenta una placa y aparece la ronda 2.
6. **El aprendizaje.** Lo que se corrigió vuelve a la ficha; la siguiente pieza sale mejor.
7. **El cierre.** Las personas ponen el criterio, el sistema produce, la marca aprueba.

---

Fuentes: reunión del 2026-10-29 (modelo uno a uno con marcas medianas), `coevo-skills/SISTEMA.md`, el circuito
de NORA (`negocio/competitive-research.md`) y el caso Mi Saluteca (2026-10-30).
