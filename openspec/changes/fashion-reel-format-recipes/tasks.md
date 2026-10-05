## 1. Hecho

- [x] 1.1 Tipo `MotionRecipe` y 4 formatos placeholder.
- [x] 1.2 Tira en loop + grilla en la columna del costado.
- [x] 1.3 Con formato activo se ocultan Story/Looks, estilo visual y accesorios.

## 2. Falta

- [x] 2.1 Pasar la receta a `config` y que `handleAnimate` use su `motionPrompt`.
- [x] 2.2 La cantidad de clips sale del `role` de la receta (one-per-clip · sequence · single).
- [x] 2.3 La receta fija el encuadre de la imagen base (cuerpo entero para el giro, etc.).
- [x] 2.4 Sacar el fondo de los `motionPrompt` y el campo "Color de fondo" del giro: el fondo
      lo da el selector del usuario; default de la receta sólo si no elige.
- [x] 2.4b **Bug encontrado al conectar:** el preset de escenario (oculto con receta) arranca en
      "estudio blanco", le ganaba al fondo elegido y además impedía mandar la imagen del fondo
      como referencia. Con receta se neutraliza en `readCfg()`, en un solo lugar.
- [x] 2.4d El modelo y la duración los elige el usuario; la receta los pre-carga.
      Selector único en Fashion Reel: Kling V3 Pro / V3 Std / V2.6 Pro / V2.5 Turbo / Seedance 2.5 (kie).
- [ ] 2.4c "Un clip por look" vs "secuencia": hoy generan las mismas escenas y el Render concatena
      todo. La diferencia (clips separados vs un video) llega con `shared-video-editor`.
- [ ] 2.5 Validar cada formato generando y medir su variabilidad de movimiento.
- [ ] 2.6 Derivar formatos nuevos de los videos de Koxis (los baja Keila).

## 3. Seedance copiando el movimiento (ver design.md)

- [ ] 3.1 **PENDIENTE — se hace en el chat con el usuario.** Prueba A/B: giro con Kling vs Seedance
      por kie con `[Video1]` = video real (~$1.81). Requiere su OK: es gasto real.
- [ ] 3.2 Si gana: campo `sourceVideoUrl` en la receta (video original, público, 480p–720p).
- [ ] 3.3 Rama Seedance con video de referencia en `handleAnimate`, manteniendo la aprobación del still.
