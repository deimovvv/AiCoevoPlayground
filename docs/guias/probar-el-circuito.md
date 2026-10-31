# Probar el circuito: estrategia → plan → entrega → aprendizaje

**Para quién:** quien tenga que confirmar que lo construido el 2026-10-30/31 anda en
`app.coevoagency.com`. Lo automático ya lo probó Claude en local; esto es lo que **sólo una persona
puede probar** (el micrófono, arrastrar con el mouse, ver la pieza como la ve el cliente).

**Con qué:** la marca **Mi Saluteca**, que ya tiene estrategia cargada y un carrusel en Entregas
(«Cómo compartir un estudio con tu médico», ángulo A · Institucional). Unos 20 minutos.

Anotá al lado de cada paso ✅ o ❌ y qué viste. Lo que falle, pasáselo a Claude con la captura.

---

## 1 · La estrategia (Marca)

| # | Hacé | Tiene que pasar |
|---|---|---|
| 1.1 | Entregas → **Plan** | Arriba: «¿Quién ve los estudios de tu familia? #QuiénLoVe» |
| 1.2 | Mirá la línea debajo de la fecha (en octubre) | «Este mes no tiene ángulo. Desde Noviembre: A · Institucional · Puerta abierta…» |
| 1.3 | Pasá a noviembre con la flecha › | La línea cambia a «A · Institucional · Puerta abierta…» y en Ángulos se resalta A |

## 2 · El calendario (Plan → Semana y Mes)

| # | Hacé | Tiene que pasar |
|---|---|---|
| 2.1 | Tocá el carrusel en el calendario | A la derecha: su imagen, Cuándo y Dónde |
| 2.2 | Cambiá la hora en «Cuándo» | La tarjeta se mueve a esa hora |
| 2.3 | Prendé Instagram y TikTok | La tarjeta dice «Instagram · TikTok» |
| 2.4 | Arrastrá la tarjeta a otro día y otra hora (ej. martes 3/11, 18:30) | Queda ahí, a la media hora más cercana |
| 2.5 | «Sacar la fecha» | Pasa a «Sin fecha», a la derecha |
| 2.6 | **Distribuir** (con la pieza aprobada y sin fecha) | Le propone un día hábil libre a las 13:00 y avisa «Propuse fecha para 1 pieza» |
| 2.7 | Pestaña **Mes** | La pieza aparece en su día con su miniatura |
| 2.8 | Pestaña **Tablero** | La pieza en su columna (En desarrollo / Por revisar / Lista…) con su tapa grande |

> Distribuir sólo mueve piezas **aprobadas**. Si el carrusel no está aprobado, aprobalo antes en Entregas.

## 3 · Confirmar la semana (sin Postiz todavía)

| # | Hacé | Tiene que pasar |
|---|---|---|
| 3.1 | **Confirmar la semana** | Un resumen: qué sale, cuándo, dónde; en rojo lo que falta (sin aprobar, sin red, sin ángulo) |
| 3.2 | «Programar N en Postiz» | «Postiz todavía no está conectado. No se programó nada.» — y **nada cambia** |

## 4 · La entrega y las notas de voz (Entregas)

| # | Hacé | Tiene que pasar |
|---|---|---|
| 4.1 | Abrí el carrusel | Debajo del título: la fase (ej. POR REVISAR), «Ángulo: A · Institucional» y «Sale … · 1 red» |
| 4.2 | Cambiá el ángulo desde la lista | Se guarda; en el Plan cambia el conteo de ángulos |
| 4.3 | Entrá a una lámina, marcá un punto y **Nota de voz**: «el título tiene que ser más corto» → Cortar | «Transcribiendo…» y aparece el comentario con el texto, el reproductor y el tipo (TEXTO) |
| 4.4 | Escribí un comentario: «ese azul está muy apagado» | Aparece enseguida; al recargar (unos segundos después) dice COLOR |
| 4.5 | «Ver como cliente» → la misma pieza | El cliente también tiene «Nota de voz» |

> **Si 4.3 dice «nota de voz sin transcribir»:** el audio quedó guardado, pero Google no respondió (el
> 2026-10-31 la key de Coevo daba 429 = sin cupo). Revisar el cupo en AI Studio.

## 5 · El aprendizaje (Plan → Aprendizaje)

| # | Hacé | Tiene que pasar |
|---|---|---|
| 5.1 | Abrí Aprendizaje | «Qué se corrige» con barras por tipo (los comentarios de 4.3 y 4.4) |
| 5.2 | Dejá 3 comentarios del mismo tipo (en una o varias piezas) | Aparece un **candidato a regla** con las láminas y el punto marcado |
| 5.3 | **Hacer regla** → «Los títulos van en dos líneas como máximo» | Aparece en «Reglas de la marca» |
| 5.4 | Pedile a Claude «ver_marca mi-saluteca reglas_aprendidas» | Devuelve esa regla |
| 5.5 | «Por ángulo» | Tarjeta por ángulo con las tapas de sus piezas, «a la primera» y vueltas |
| 5.6 | Borrá los comentarios y la regla de prueba | Quedan como antes |

## 6 · Lo que todavía no se puede probar

- **Programar en Postiz y las métricas** (columna «Alcance»): falta la cuenta de Postiz.
- **Que las skills elijan el ángulo y respeten las reglas solas**: falta tocar `coevo-skills`.
- **Distribuir con el ritmo de la marca** (2 carruseles + 1 reel por semana): todavía pone una por día.
- **Editar la estrategia desde Marca**: hoy se carga con Claude.

Detalle técnico y pendientes: `openspec/changes/brand-integrations/tasks.md` y
`openspec/changes/brand-strategy/tasks.md`. Cómo opera todo: `docs/producto/operacion.md`.
