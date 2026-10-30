# Cómo se opera Coevo Studio: formatos, skills y el día a día

**Estado:** borrador para revisar con Gonzalo (2026-10-30). Nada de esto está decidido todavía.
**Por qué existe:** *"definamos cuáles son las skills y cuáles son los formatos que ofrecemos, porque
nos estamos confundiendo. Son muchos formatos"* (Gonzalo, 2026-10-30).

Base: la reunión del 29/10 (modelo uno a uno: una persona opera para una marca mediana), `SISTEMA.md`
de coevo-skills (dónde vive cada cosa) y el circuito de NORA (`negocio/competitive-research.md`).

---

## 1. Tres palabras que se estaban mezclando

| Palabra | Qué es | Quién la ve | Ejemplo |
|---|---|---|---|
| **Formato** | Lo que la marca **compra y recibe** | el cliente | un carrusel, un reel explicativo |
| **Skill** | **Cómo se hace** un formato (la receta) | el equipo | `carrusel`, `reels-explicativos` |
| **Tool de Studio** | Una pantalla, sólo cuando lo opera alguien sin terminal | el equipo | Fashion Reel, Ecommerce Pack |

Regla: **se vende un formato, se produce con una skill.** Un formato puede usar más de una skill, y hay
skills que no son ningún formato (ordenar archivos, chequear conexiones, leer imágenes).

## 2. Lo que ofrecemos (propuesta: pocos formatos, bien hechos)

### Contenido mensual (Coevo Studio)

| Formato | Skill que lo hace | Probado con cliente real |
|---|---|---|
| **Carrusel** | `carrusel` | ✕ (falta el primero) |
| **Reel explicativo dibujado** | `reels-explicativos` | ◐ |
| **Reel de marca** (montaje con material que ya existe) | `reel-marca` | ◐ |
| **Reel con persona hablando** (UGC, avatar) | `pipeline-contenido` + `escena-seedance` | ◐ |

`grabar-web` **no es un formato para redes**: es una skill de apoyo (filma una app o una web para usar
adentro de otra pieza). Corrección de Gonzalo, 2026-10-30.

**La lista no está cerrada:** los formatos se curan a medida que entran clientes reales. Esta tabla es
el punto de partida, no la oferta final.

### Moda (Morph)

| Formato | Skill / tool |
|---|---|
| **Fichas de e-commerce** con calce verificado | `ficha-ecommerce` |
| **Video catálogo / reel de un look** | Fashion Reel + `escena-seedance` |

### Entrada de una marca (una vez, no es un formato mensual)

`auditoria-creativa` → `mapa-de-mercado` → `spec-campana`, y `design-system` si la marca no tiene uno.

**Regla para sumar un formato:** sólo si ya se hizo con una skill para tres marcas distintas, o si lo
pide un cliente que paga. Hasta entonces es una prueba, no algo que se ofrece.

## 3. Dos modos de operar una marca

Gonzalo, 2026-10-30: *"yo le puedo pedir a Keyla que me haga el carrusel, pero hay marcas, como NORA, donde
no lo hace manual: lo hace solo el sistema, según las charlas y los ángulos que definieron"*.

| | **Operado por una persona** | **Operado por el sistema** |
|---|---|---|
| Quién dispara una pieza | la persona le pide a Claude ("hacé un carrusel para…") | el sistema, desde el plan del mes y los ángulos de la marca |
| Qué decide la persona | el guion, el gasto, cada pieza | los ángulos y la estrategia, en la reunión; después revisa |
| Subida a Studio | a mano, con OK | automática: la pieza entra a Entregas como interna |
| Lo que nunca se automatiza | mandar al cliente y publicar | mandar al cliente y publicar |
| Para qué marcas | las que recién entran, o donde cada pieza es distinta | las que ya tienen ficha completa, ángulos definidos y formatos probados |

Una marca **empieza** operada por una persona y **pasa** al sistema cuando su ficha y sus formatos están
probados (el «a la primera» alto). Es la misma regla de siempre: se automatiza lo que ya se hizo a mano
varias veces.

**Para que el modo sistema exista falta:** ángulos de la marca guardados como datos en Studio, un plan del
mes que los use, y que el MCP pueda escribir (crear proyectos y subir sin intervención).

## 4. El día a día de la persona que opera una marca

Tres ritmos. En cada paso: quién hace qué y dónde queda.

### Una vez, al entrar la marca (≈ 1 día)

1. **Reunión de arranque** con el cliente.
2. **Cargar la ficha en Studio** (Marca): quién es, colores, letras, logo, design system, caras.
   *Sin esto ninguna skill entrega bien: con colores y letras sale un borrador, no una entrega.*
3. **Estrategia**: auditoría → mercado → spec de campaña.
4. **Elegir 2 o 3 formatos y la frecuencia** (ej. 2 carruseles y 1 reel por semana). Queda en la ficha.
5. Crear el archivo de **piezas** de la marca y cargar su link en Studio.

### Cada semana

| Paso | Persona | Claude (skills) | Cliente | Dónde queda |
|---|---|---|---|---|
| **Reunión** (45 min) | conduce | prepara la agenda con lo entregado y lo pendiente; después ordena la transcripción | pide, decide | decisiones y pedidos (skill `reunion`, **por hacer**) |
| **Plan de la semana** | elige qué piezas | propone temas desde la estrategia | — | proyecto en Studio |
| **Producir, de a una** | da el OK al guion y al gasto | arma la pieza leyendo la ficha (`ver_marca`) | — | `~/cov/archivos/<marca>/` |
| **Revisión interna** | mira y corrige | rehace lo que se marca | — | idem |
| **Entrega** | decide mandarla | sube la pieza (`subir_entrega`, queda interna) | — | Studio → Entregas |
| **Aprobación** | — | registra las vueltas y qué se corrigió, por tipo | aprueba o comenta en Studio | `run.json` + aprendizajes |
| **Publicar** | programa | — | — | Postiz (**por conectar**) |

### Cada mes

- **Informe**: piezas, vueltas hasta la aprobación, costo, y alcance / guardados / compartidos a los 7 días.
- **Ajustar la ficha** con lo que se repitió (una corrección que aparece tres veces es una regla de la marca).

## 5. Lo que falta para que este día a día funcione

| Hueco | Qué frena | Prioridad |
|---|---|---|
| **Skill `reunion`** (preparar y ordenar) | la reunión no alimenta nada | alta |
| **El MCP no escribe la ficha** (sólo la lee) | lo aprendido se carga a mano en Studio | alta |
| **Un primer carrusel real** | la skill está probada con placas sueltas, no con un cliente | alta |
| **Publicar y medir** (Postiz) | sin números a los 7 días no hay informe | media |
| **Vueltas y costo visibles en Studio** | el «a la primera» de NORA no se ve | media |

## 6. Preguntas abiertas (del aviso de coevo-skills, 2026-10-30)

1. **Huecos de la ficha.** Coevo, ALGÜNA (`alkura`), Morph y Mi Saluteca no tienen design system cargado.
   Mi Saluteca ya tiene colores (de la web en vivo: océano `#2F416A`, verde `#7ABB85`, teal `#0D9488`),
   letra (Inter) y tres logos, cargados el 2026-10-30.
2. **Aprendizajes por marca.** Propuesta: lo que se repite tres veces pasa a un bloque de reglas de la
   ficha en Studio (como las «restricciones duras» de NORA); lo de cada carrusel queda en sus archivos.
3. **Entregas con PNG y MP4.** El MCP ya los recibe en orden (`archivos` = láminas en orden, acepta mp4).
   Falta probar que Studio muestre un MP4 de 1080×1350 bien.
4. **Mostrar vueltas y costo en Studio.** Propuesta: sí, en Entregas.
5. **Plantillas de placa.** Propuesta: siguen en los archivos de la marca hasta que se repitan;
   `changes/studio-v2` ya prevé plantillas por marca.
