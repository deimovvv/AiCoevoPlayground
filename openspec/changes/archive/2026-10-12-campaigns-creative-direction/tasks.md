## 0. Decidir

- [x] 0.1 Adoptar el patrón de Invent: un dueño por dominio, el moodboard como texto y
      Lighting = luz. Usuario, 2026-09-29: *"y si lo pensamos más como Invent?"*
- [x] 0.2 Fondo literal (lo que suma Coevo frente a Invent). Usuario, 2026-09-29.
- [x] 0.3 Validar con 3 imágenes, no con una matriz de 27. Usuario: *"hagamos menos imágenes"*.

## 1. Backend

- [x] 1.1 `services/campaign_direction.py`: lee el moodboard y la referencia de luz (+ brief
      opcional) y devuelve la dirección estructurada. Por `llm_router`.
- [x] 1.2 `POST /api/campaigns/direction`. Si falla, devuelve `{ok:false, reason}`, nunca 500
      callado.

## 2. Frontend

- [x] 2.1 `api.ts`: `getCampaignDirection`.
- [x] 2.2 `buildRefs`: no manda el moodboard ni la luz como imagen (salvo degradación).
- [x] 2.3 El prompt suma la dirección, aplicando la regla de precedencia.
- [x] 2.4 Tarjeta "Dirección creativa" visible antes de generar, con estado
      analizando / lista / falló.
- [x] 2.5 Control Lighting = presets + imágenes de la marca. Se saca el control Look & feel.

## 3. Validar

- [x] 3.1 Taller Santa Clara: modelo + prenda + fondo + moodboard, sin brief.
      **v1 (3 tiradas):** identidad, prenda y mood ✅; **fondo ❌ en 3/3**. El blanco
      infinito del moodboard se colaba por el estilo, la paleta y la luz, no por
      `environment`, que era el único campo filtrado.
      **v2 (2 tiradas)**, con el análisis sabiendo que hay fondo, sin paleta ni luz del
      moodboard y el fondo nombrado arriba del prompt: **fondo literal en 2/2**, identidad,
      prenda y mood se mantienen.
      Queda abierto y no es de este change: el pantalón varía entre tiradas (solo se pasó
      la remera) y la tirada 2 inventó cajas y cables.

## 4. Cerrar

- [x] 4.1 Pasar el contrato a `openspec/specs/campaigns/spec.md` y archivar el change.
- [x] 4.2 Entrada en `decisions-log.md`.
