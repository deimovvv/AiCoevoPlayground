# Estrategia: un motor, cuatro líneas (2026-10-16)

> *"dado todo lo que ofrecemos en Coevo… ¿no tiene más y mejor proyección todo esto?"* ·
> *"todo esto andá documentándolo… porque también son las ideas creativas para los ángulos de
> comunicación"* — Gonzalo, 2026-10-16

Base: [rumbo-2026-2028.md](rumbo-2026-2028.md) (investigación) y el uso real de Coevo Studio
(últimos 60 días: Lab 251, Fashion Reel 12, Campañas 11, Ecommerce Pack 5; las otras 12 tools, 0).
Desde el 21/09 la producción real sale de Claude Code + skills.

## La tesis

Generar se volvió commodity (foto en modelo a US$0,08–1; timeline generativo incluido gratis en
Higgsfield, Runway, Kling). Lo que no se vuelve commodity es **criterio guardado, memoria de cada
marca, el circuito con el cliente y la pieza publicable con calce verificado**.

Coevo tiene algo que los competidores no juntan: oficio (arte y tecnología, dirección creativa),
producción con agentes, ese criterio guardado y **cuatro puertas de entrada**. Todas usan el mismo motor.

## El motor

| Pieza | Qué es | Dónde vive |
|---|---|---|
| **Producir** | Claude Code + skills + APIs de generación (Fal, kie) | `coevo-skills` |
| **Criterio** | poses curadas, bloques de prompt, reglas aprendidas, controles de calidad — **datos, no código**, leídos por skills y app | Coevo Studio (servidor) |
| **Memoria de marca** | modelo/gemelo con consentimiento, prendas, tipografía, lo aprobado y lo rechazado | Coevo Studio (Brand Kit) |
| **Circuito** | ver, anotar, aprobar, entregar; costo por pieza a la vista | Coevo Studio (editor, portal) |
| **Medición** | por pieza: costo de API, reintentos, minutos humanos | Coevo Studio (ledger) |

**Regla:** todo nace como skill. Si se repite tres veces con marcas distintas, o lo tiene que usar
otra persona, pasa a la app (como plantilla, receta o tool con aprobaciones).

## Las cuatro líneas

| Línea | Qué vende | Cómo cobra | Rol |
|---|---|---|---|
| **Morph** | catálogo y campañas de moda | por pieza publicable / packs | **caja hoy** |
| **Coevo Studio** | el contenido del mes de una marca | fee mensual | **recurrente** |
| **Coevo · sistemas** | el sistema de producción propio de una marca (gemelo con consentimiento, poses y calce, pipeline de video, aprobación) | setup + mantenimiento | **ticket alto y defensa** |
| **Coevo · arte y tecnología** | proyectos, webs, experiencias | por proyecto | **posiciona y atrae** |

Coevo Studio es el **caso** de la línea de sistemas: *"lo construimos para producir nosotros; lo
armamos para tu marca"*. No se vende como SaaS (descartado: compite contra herramientas de centavos).

## Orden

1. **Ahora — caja:** la clienta nueva de Morph (precios de todo) y el video catálogo.
2. **En paralelo — medir:** costo, reintentos y minutos por pieza. Son los números que venden sistemas.
3. **Con 2–3 casos medidos — sistemas:** ofrecer el sistema a una marca actual (Giumati, Koxis o la clienta nueva).
4. **Ordenar la app:** visibles sólo Ecommerce Pack, Fashion Reel, Campañas, Lab y Videos; el resto escondido.

Riesgo: dispersión. Un frente nuevo entra sólo cuando el anterior tiene casos con números.

## Ángulos de comunicación

Cada uno sale de algo real que hicimos. Morph respeta su guía (sin hablar de IA:
`morph-site/docs/reference/COPY-GUIDELINE.md`); Coevo puede hablar de tecnología, porque es su oficio.

| Ángulo | Para | Frase de partida | Prueba que lo sostiene |
|---|---|---|---|
| **Esto no es una sesión de fotos** | Morph | "Es tu catálogo entero, con modelo, sin armar una producción." | video catálogo (`GUION-VIDEO-CATALOGO.md`) |
| **Pagás la foto publicable, no el intento** | Morph | "Cobramos por foto lista para tu tienda." | QC por toma; los reintentos los absorbemos |
| **Calce verificado** | Morph | "La caída, el color y el detalle de tu prenda, controlados foto por foto." | la remera POETRY: las tachas eran corazones y se respetaron |
| **De la prenda sola a la ficha, en una tarde** | Morph / Coevo Studio | "Nos pasás la prenda como la tengas." | short + body: estirada → maniquí → modelo → video |
| **El archivo de tu marca vale más que un prompt** | Coevo · sistemas | "Tu modelo, tus poses, tu calce: guardados y reusables." | Brand Kit, librería de poses |
| **Lo construimos para nosotros** | Coevo · sistemas | "Esto lo armamos para producir. Lo armamos para tu marca." | Coevo Studio como caso, con números |
| **Tu modelo, con contrato** | Coevo · sistemas / Morph | "Cara y voz con permiso escrito." | consentimiento (como H&M con sus gemelos) |
| **El costo a la vista** | Coevo Studio | "Sabés cuánto cuesta cada pieza antes de producirla." | ledger de costos por pieza |
| **Detrás de escena sin cara** | Coevo Studio (Instagram) | "Así se hace una ficha." | grabaciones del proceso: prenda → poses → toma → video |
| **Arte y tecnología, no herramientas** | Coevo | "No vendemos IA. Hacemos que tu marca produzca como un estudio." | proyectos de Coevo + el motor |

## Qué no hacemos

- SaaS self-serve que compita por precio de generación.
- Un editor generativo completo (lo regalan las plataformas grandes); el nuestro es chico: ver, anotar, aprobar, exportar.
- Tools nuevas sin una skill que se haya repetido antes.
- Caras o voces reales sin permiso escrito.
