## Why

Campañas recibe un moodboard, un fondo, una pose, una luz, una modelo y un
producto. Hasta ahora no había una regla que dijera qué aporta cada uno:

- **El fondo no se respetaba.** Reporte del usuario (2026-09-29): *"le pasé fondo y
  el fondo no lo agarró"*. Todas las imágenes llegaban al generador en un mismo
  array y el prompt solo explicaba qué hacer con modelo, producto y prenda.
- **Nadie analizaba el moodboard.** El planner (`campaign_planner.py`) lee solo el
  texto del brief, y el frontend lo llama recién con 15 caracteres o más. Sin brief
  no había estrategia, y el moodboard llegaba al generador como "una imagen más".
- **La luz tenía tres dueños**: el preset de Iluminación (texto), la imagen de Look &
  feel ("solo color y grade") y la luz propia del moodboard. Ninguna regla decía
  cuál ganaba.

El objetivo de producto (usuario, 2026-09-29): que un director de arte, diseñador
o AI artist que arme una campaña para un auto, un producto o una marca de ropa
pueda pasar moodboard + referencias estéticas y que el resultado sea predecible.
*"Que se diga que está muy pro."* Que sea pro depende menos de que salga lindo una
vez que de que se pueda **predecir qué cambia al tocar cada input**.

## What Changes

Se adopta el patrón de **un dueño por dominio**, tomado de Invent (cliente
confidencial; se adaptan patrones, no código). Lo verificó Invent con pruebas el
2026-09-29:

| Dominio | Dueño | Cómo llega al generador |
|---|---|---|
| Concepto, tono, contexto | **Brief** (opcional) | texto |
| Mundo: mood, paleta, estilo fotográfico | **Moodboard** | **solo texto**, vía la Dirección creativa. La imagen NO se manda |
| El lugar, literal | **Fondo** | **imagen**, con orden de usarlo exacto |
| Postura y encuadre | **Pose** | imagen |
| La luz | **Lighting**: un preset **o** una imagen de referencia | **solo texto** (la luz analizada) |
| Identidad | **Modelo** | imagen |
| Fidelidad | **Producto / prenda** | imagen |

**Regla de precedencia:** el input específico le gana al moodboard en su dominio.
Con fondo, el entorno del moodboard no se aplica. Con pose, la pose del moodboard
tampoco. Con Lighting, la luz del moodboard tampoco.

El fondo literal es la única diferencia con Invent, que no tiene ese input y trata
el entorno del moodboard como contexto. En este caso copiar es justamente lo que se
quiere.

### Dirección creativa (paso nuevo, visible)

Antes de generar, un análisis lee el moodboard, la referencia de luz y el brief (si
hay) y devuelve: paleta (hex), estilo fotográfico, entorno, pose sugerida, mood y
luz, más un resumen en español. **Se muestra en pantalla antes de gastar**: es el
paso de *creative strategy* que pidió el usuario. **Funciona sin brief.**

Si el modelo de visión rechaza una imagen (pasa con fotos de gente joven), el paso
**avisa en pantalla** y se genera mandando el moodboard como imagen con su
instrucción. No cae en silencio.

### Lighting unifica Iluminación y Look & feel

Por qué: la prueba de Invent mostró que lo que se transfiere de una referencia de
"look" es la luz, y que el grade suma poco y a veces se pasa. Un solo control,
**Lighting**, con dos fuentes que se excluyen: presets del sistema o imágenes de la
marca/campaña. Por dentro las claves siguen siendo `lookFeelId` / `lookAndFeel`, así
no se tocan datos guardados.

## Capabilities

### New Capabilities

- `campaigns`: cómo una campaña combina sus referencias y produce la dirección
  creativa. (Se crea acá. `campaigns-as-hub` suma después la parte de video).

## Impact

- **Backend:** `services/campaign_direction.py` (nuevo) + `POST /api/campaigns/direction`.
  Va por `llm_router` con `GEMINI_API_KEY` de Coevo o falla. Nunca otra key de Google.
- **Frontend:** `NewCampaignPage.tsx`: `buildRefs` deja de mandar moodboard y luz como
  imagen, el prompt suma la dirección y el control Lighting reemplaza a Iluminación y
  Look & feel. `api.ts`: `getCampaignDirection`.
- **Diseño:** el control "Look & feel" desaparece de Campañas y sus imágenes pasan a
  la pestaña "De la marca" del control **Iluminación**, que conserva su nombre. No se
  renombró a "Lighting" en la UI: los nombres visibles le tocan al chat de diseño
  (`frontera-diseno-infra.md`), así que queda avisado.
- **Costo:** una llamada de visión por combinación de referencias (se cachea). Antes
  de cada corrida, nada nuevo.
