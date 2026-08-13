# Pipeline de Producción Visual IA — SOP v1

> **Origen:** destilado del proyecto PROMAN / GPO Fertilizantes (Emisarios, Ago 2026), del operador que hoy lo hace **manual**.
> **Objetivo:** convertir un guion + una referencia estética + material del cliente en un set de imágenes consistentes, con el mínimo de intervención humana.
> **Uso en Coevo:** es el método a **superar** con el Video Ad Creator. Ver [`decisions-log.md`](decisions-log.md) para cómo se va mapeando al tool. Estado del mapeo al final de este doc.

---

## Principio rector

Dos **gates humanos obligatorios** y siete fases automatizables. Los gates son los dos puntos donde el error **no se ve en el output**: un prompt malo da una imagen fea (se ve al instante); un dato falso da una imagen perfecta pero incorrecta (se descubre publicada).

| Fase | Automatizable | Gate humano |
|---|---|---|
| 0 — Verificación factual | Parcial | **Sí** |
| 1 — Ingesta | Sí | No |
| 2 — Análisis de referencia | Sí | No |
| 3 — Verdad visual | Sí | No |
| 4 — Módulo de estilo | Sí | No |
| 5 — Personajes | Sí | No |
| 6 — Escena master | Sí | **Sí (aprobación)** |
| 7 — Escenas derivadas | Sí | No |
| 8 — Corrección | Parcial | No |
| 9 — Elementos prohibidos | Sí (bloqueo duro) | No |

---

## FASE 0 — Verificación factual del guion
**Antes de leer la estética. Antes de todo.** En PROMAN evitó dos errores que llegaban a publicación: el "Pechocho" es un **delfín** (ícono local 40 años), no un ave; y la locación tiene **litigio activo** donde el animal del guion es símbolo de la campaña opositora. Ninguno se detecta mirando una imagen; ambos con 5 min de búsqueda.

**Checklist:** entidades nombradas (qué es, cómo se ve, si existe) · claims verificables (cifras/fechas/récords → pedir fuente al cliente, no ilustrar sin respaldo) · contexto de conflicto (noticias últimos 12 meses) · símbolos e identidad (escudos, logos, uniformes) · personas reales identificables.

**Output:** ficha de verificación (entidades resueltas, claims marcados, flags de conflicto, elementos que no se generan). **La decisión de avanzar es humana** — si hay flag o claim sin fuente, el pipeline se detiene y escala.

## FASE 1 — Ingesta
Cuatro inputs, **ninguno opcional**: brief comercial (formato/duración/aspect/volumen) · guion (escenas/personajes/diálogo) · referencia estética (cómo se renderiza) · **material real del cliente (cómo se ve el lugar de verdad)**. El cuarto es el que más se saltea y más caro sale: sin material real, paleta y geografía se **inventan** y sale genérico. En PROMAN la paleta de memoria (verdes salvia apagados) estaba mal — el lugar real es **alta saturación**. **Requisito:** archivos, no screenshots (de una captura no se muestrea color).

## FASE 2 — Análisis de referencia estética
1. Specs técnicos del archivo (resolución, fps, duración, aspect). 2. Extracción de frames cada 1,5–2s, contact sheets de 6–9. 3. Frames alta-res en momentos clave. 4. Descomposición en 7 ejes: material/construcción · comportamiento de sombra · tratamiento de superficie (mate/brillante/especular) · cámara (ángulo/distancia/DoF) · luz (dirección/dureza/fuente) · paleta y saturación · tipografía.

**Eje del estilo:** todo sistema tiene **un rasgo que carga el 70% del efecto**; si se rompe, se cae todo. Papel recortado → **sombra proyectada dura debajo de cada capa**. Playmobil/juguete → **DoF corta + bokeh de fondo**. Ese eje se declara siempre, va alto en el prompt y **no se negocia**.

**Nomenclatura:** el cliente puede nombrar mal el sistema. En PROMAN pidieron "Playmobil" sobre un video que era **LEGO** — incompatibles (studs/ladrillo vs pieza moldeada lisa). La palabra en el prompt cambia el output entero.

**Bonus:** si la referencia es tutorial/case study, mirar si dejó el prompt visible en pantalla (en PROMAN salió de ahí el orden de bloques completo).

## FASE 3 — Extracción de verdad visual del material real
El material del cliente manda sobre **QUÉ**; la referencia estética sobre **CÓMO**. Se extrae: **paleta muestreada** (no inventada) · **marcadores geográficos específicos** (PROMAN: cactus columnar + manglar + bobo patas azules + cerro verde = Golfo de California — esto blinda la localización, "in Mexico" al final no hace nada) · **vestuario/equipamiento reales** · **arquitectura/infraestructura** (domos rojo óxido + acero blanco + grúa roja = silueta de la planta) · **huecos** (qué escena NO tiene respaldo fotográfico → pedir antes de inventar).

**Personas reales:** referencia de arquetipo/vestuario/rol/luz, **nunca** parecido facial. Los personajes se diseñan desde cero.

## FASE 4 — Módulo de estilo lockeado
Bloque de texto fijo, reusable, pegado idéntico en toda escena del guion. **Orden:** 1) declaración de material/medio (primera línea, siempre) 2) regla global de construcción 3) construcción de personajes 4) bloque de escena (sujeto/acción/entorno) 5) composición 6) iluminación 7) paleta 8) Do Not 9) cierre que repite la declaración de material. **Un módulo por estética, nunca mezclar** (papel recortado prohíbe el blur; juguete lo exige).

**Bloque Do Not:** acumulativo — cada deriva detectada en corrección entra y no vuelve. Reales: `No studs. No brick construction.` · `No palm trees. No long hanging foliage.` · `No drawn facial lines.` · `No orca or killer whale markings.`

## FASE 5 — Descripciones de personaje lockeadas
Un bloque fijo por personaje, copiado **textual** en toda escena. Contiene: edad/contextura/proporción · piel y pelo (en el material del sistema) · vestuario completo con colores · rasgo de construcción que lo ancla. **Reglas:** proporción explícita cuando importa (`head-to-body ratio of one to seven and a half`, no "adolescente") · **escala relativa contra otro personaje lockeado** es la ancla más fuerte (`Emiliano is now clearly taller than Doña Chayo`) · un elemento de vestuario **invariable** por personaje · excluir el estado anterior en evoluciones (`No child proportions. No bowl haircut.`).

## FASE 6 — Escena master
**Se genera y aprueba UNA sola escena antes de tocar el resto.** Se elige la que contenga más elementos del sistema (personajes principales + entorno completo + paleta entera; en PROMAN, escena 1). Produce: validación de módulo + paleta + **el archivo que se carga como `@img1` en todas las escenas siguientes**. **Gate: aprobación explícita** — si los personajes cambian después, se cae la continuidad de la pieza entera.

## FASE 7 — Escenas derivadas
```
@img1 approved master reference — locks [qué lockea]. Match exactly.
[MÓDULO DE ESTILO] [BLOQUES DE PERSONAJE] [BLOQUE DE ESCENA]
[COMPOSICIÓN] [ILUMINACIÓN] [PALETA] [DO NOT] [CIERRE]
```
**Continuidad:** dirección de luz **constante** en todo el guion (aunque el guion diga MAÑANA vs DÍA — en estilizado la sombra es parte del sistema; si cambia se lee como error) · **exclusiones de arrastre** (elementos del master que NO deben aparecer se excluyen explícitos: `No nursery bags or seedlings.`) · **variante de seguridad por escena** (una alternativa de menor riesgo; se generan las dos y se compara).

## FASE 8 — Corrección
**Regla dura:** tras 2–3 intentos fallidos en un mismo elemento → **Photoshop/After Effects, no se sigue iterando**. Casi siempre escalan: manos unidas, objetos chicos sujetados, texto, logos, insignias, geometría técnica. Cada prompt se entrega con su lista de **puntos de falla** y la salida de cada uno (se anticipan, no se descubren en el momento). **Ciclo de deriva:** detectar → agregar al Do Not del módulo → corregir el bloque → **nunca corregir solo esa escena**, entra al módulo y aplica a todas.

## FASE 9 — Elementos que nunca se generan (bloqueo duro)
| Elemento | Por qué | Cómo se resuelve |
|---|---|---|
| Logos y wordmarks | Ningún modelo los reproduce fiel | Vectorial oficial, compuesto en AE |
| Escudos/emblemas oficiales | Error institucional caro | Asset oficial del cliente |
| Texto en pantalla | Falla o se deforma | Tipografía real en post |
| Insignias de dependencia | Inventarlas es peor | Se omiten o se piden |
| Parecido de personas reales | Sin consentimiento | Arquetipo, no parecido |
| Claims sin fuente ilustrados | No se sostiene | Placa de marca atribuida |

---

## Nota de cierre del operador
> Lo que hace rentable el pipeline no es la velocidad de generación: es que **el sistema se define una vez por guion y después cada escena es ensamblado**. En PROMAN, la escena 1 llevó el trabajo de fondo; las 2, 3 y 5 salieron en minutos. Ese es el margen — y el argumento comercial: el freelance cotiza por pieza (empieza de cero cada vez); nosotros por **línea creativa**, porque el sistema amortiza.

---

## Mapeo al Video Ad Creator (estado a 2026-08-13)

| Fase SOP | En el tool hoy | Gap |
|---|---|---|
| 0 Verificación factual | ✗ | Falta gate de research (entidades/claims/conflicto) antes de estética |
| 1 Ingesta | ✓ brief + refs + material de marca | "Material real" no es bloqueante ni separado de "estética" |
| 2 Análisis de referencia | ✗ (hay presets `AD_STYLES`) | Falta descomponer una ref subida en 7 ejes + detectar eje dominante |
| 3 Verdad visual | ✗ | Falta muestreo de paleta + marcadores geográficos desde el material |
| 4 Módulo de estilo lockeado | Parcial (`ad_style` preset inyectado) | No es un bloque reusable con orden fijo + Do Not acumulativo |
| 5 Personajes lockeados | ✓ paso `character` (refs maestras, gate) | Falta bloque de texto lockeado + proporción/escala relativa explícita |
| 6 Escena master | ✓ `base_image` frame 1 con `needsApproval` | — |
| 7 Escenas derivadas | ✓ `handleImages` ancla master `@img1` en cada frame (reforzado: master primero, lockea locación/paleta/estilo) | Falta exclusión de arrastre + variante de seguridad |
| 8 Corrección | Parcial (ImageEditPanel por frame) | Falta Do Not acumulativo automático + regla de escalar a post |
| 9 Bloqueo duro | ✗ | Falta lista de no-generar (logos/texto/emblemas) enforced |

**Decisión (2026-08-13):** una sola locación por guion; NO se genera un paso de locaciones separado — la locación vive en la **escena master** y se propaga como `@img1` a todas las derivadas (Fase 6→7). El material real de la locación se carga en Reference Images / Backgrounds (Fase 1) y ancla el master.
