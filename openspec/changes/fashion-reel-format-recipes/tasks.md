## 1. Hecho

- [x] 1.1 Tipo `MotionRecipe` y 4 formatos placeholder.
- [x] 1.2 Tira en loop + grilla en la columna del costado.
- [x] 1.3 Con formato activo se ocultan Story/Looks, estilo visual y accesorios.

## 2. Falta

- [ ] 2.1 Pasar la receta a `config` y que `handleAnimate` use su `motionPrompt`.
- [ ] 2.2 La cantidad de clips sale del `role` de la receta (one-per-clip · sequence · single).
- [ ] 2.3 La receta fija el encuadre de la imagen base (cuerpo entero para el giro, etc.).
- [ ] 2.4 Sacar el fondo de los `motionPrompt` y el campo "Color de fondo" del giro: el fondo
      lo da el selector del usuario; default de la receta sólo si no elige.
- [ ] 2.5 Validar cada formato generando y medir su variabilidad de movimiento.
- [ ] 2.6 Derivar formatos nuevos de los videos de Koxis (los baja Keila).
