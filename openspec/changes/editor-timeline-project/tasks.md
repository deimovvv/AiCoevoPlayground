## 1. Mapa y formato

- [x] 1.1 Mapa tool / editor / skill (proposal) en MAP.md y decisions-log.
- [x] 1.2 `timeline.json` v1 (design.md).

## 2. Backend

- [x] 2.1 Abrir y guardar un proyecto desde una carpeta (raíces permitidas; conflicto si Claude lo cambió).
- [x] 2.2 Servir sus archivos con rangos (206 verificado; rechaza rutas fuera del proyecto).
- [x] 2.3 Notas → `notas.md`.
- [x] 2.4 Exportar un proyecto con FFmpeg (tramos, congelado, rótulos, voz, `extra`) → textos → música →
      revisión, todo en `<proyecto>/export/`. End Cards (`montar5.sh`): 62,97 s vs 62,86 s, cuadros iguales
      en 1,5 / 20 / 35 / 50 / 61,5 s.

## 3. Editor

- [ ] 3.1 Tramos de imagen fija.
- [ ] 3.2 Locución por tramo (el tramo dura lo que su voz) y rótulo encima.
- [ ] 3.3 Página del editor por proyecto; recarga si Claude cambió el archivo.

## 4. Casos de prueba

- [ ] 4.1 End Cards: abre, reproduce y exporta igual a `ENDCARDS.mp4` (salvo el congelado).
- [ ] 4.2 Morph (`reel-marca`): necesita bloques animados — otro change.
