## Context

Primer caso real: el explainer de End Cards (42 s, 1600×900, 30 fps). Hoy lo arma
`montar4.sh` con FFmpeg: 11 tramos de grabación de pantalla + una placa, cada uno con un
rótulo PNG transparente encima, y **cada tramo dura lo que su línea de locución**
(`vo/01.mp3`…`vo/12.mp3`). Hubo 4 versiones del script, una por vuelta de corrección.

## `timeline.json` — versión 1

```json
{
  "version": 1,
  "title": "End cards — explainer",
  "width": 1600, "height": 900, "fps": 30,
  "background": "#0B1020",
  "segments": [
    { "id": "t01", "src": "u-pieza.mp4", "in": 0.0, "voice": "vo/01.mp3", "overlay": "r01.png", "label": "una pieza terminada" },
    { "id": "t12", "src": "placa_fin.png", "voice": "vo/12.mp3", "label": "placa final" }
  ],
  "texts": [],
  "music": null
}
```

- Rutas **relativas a la carpeta** del proyecto.
- **Duración de un tramo:** `duration` si está; si no, lo que dure `voice`; si no, `out − in`;
  si no, el largo del archivo (imagen: 3 s).
- **Fuente más corta que el tramo** (pasa en 2 de 11 tramos de End Cards): se **congela el
  último cuadro**. `montar4.sh` repetía el clip; repetir una grabación de pantalla reinicia
  la acción a mitad de camino, congelar se lee mejor. Vista previa y export hacen lo mismo.
- `texts` y `music`: los mismos modelos del editor (`textLayerModel`, `musicModel`).
- Campos desconocidos se conservan al guardar (Claude puede sumar los suyos).

## Ida y vuelta con Claude

- La UI escribe en el mismo `timeline.json` (orden, recortes, textos, música). Claude lee
  ese archivo, no un estado escondido de la app.
- Las notas van a `notas.md` en la carpeta, una por línea: `- 0:12.4 · t05 — texto`.
- El editor mira la fecha del archivo cada 2 s y se recarga si Claude lo cambió.

## Seguridad (local)

El backend sólo abre carpetas dentro de `~/Downloads`, `~/Documents`, `~/Desktop` y `~/cov`,
resuelve symlinks y rechaza `..`. No copia nada a `backend/data/`.

## Export

FFmpeg por tramo (desde `in`, congelado si hace falta, escalado y centrado sobre `background`,
rótulo encima) → concat → voz (silencio en tramos sin voz) → los pasos que ya existen:
textos (Remotion) y música. Mismo resultado que `montar4.sh`, salvo el congelado.
