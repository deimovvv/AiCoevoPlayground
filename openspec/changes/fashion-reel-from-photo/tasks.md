## 0. Decidir

- [x] 0.1 Foto como cuadro 1 + planos anclados, reusando el mecanismo de UGC. Usuario, 2026-10-13.

## 1. Construir

- [x] 1.1 `handleScript`: escenas por plano desde la foto (sin prendas).
- [x] 1.2 `handleBaseImage`: la foto tal cual.
- [x] 1.3 `handleMultishot`: ancla de consistencia cuando no hay prendas.
- [x] 1.4 Casilla "Usar esta foto como base" en Fashion Reel (pasa a Looks).
      ⚠️ Nunca se veía: estaba dentro del bloque de referencias, que excluye a fashion_reel.
- [x] 1.5 (2026-10-14) Selector "¿De dónde sale el reel?" arriba del panel: **Desde una foto** /
      Generar. En modo foto: subir la foto y elegir planos; se ocultan Formato, Model, Prendas,
      Fondo, Escenario, Accesorios y Estilo visual. Pedido del usuario: *"me hace poner prenda…
      un todo. No queda claro"*.
- [x] 1.6 (2026-10-14) Casilla "La foto no muestra la cara": los planos generados y la animación
      reciben la orden de mantener la cara fuera de cuadro (si apareciera, la inventa el modelo).
      Regla del usuario: *"si le cortás la cara en la imagen, que no se vea la cara porque va a ser otra persona"*.

- [x] 1.7 (2026-10-14, prueba con Keila: *"no fue para nada intuitivo"*) La foto es su propio plano
      ("1 · Tu foto", con miniatura, "va tal cual"); los planos elegidos se GENERAN todos desde ella
      (antes el primero elegido "era" la foto). El plano foto tiene un movimiento natural propio.
- [x] 1.8 Fuera "Duración del guión" en Fashion Reel (no se usaba): el largo = clips × duración por
      clip, y se muestra calculado ("3 clips × 5 s = 15 s de reel"). La duración por clip se veía
      sólo si el motor estaba elegido a mano: ahora aparece con el motor por defecto (Kling).

## 2. Validar

- [ ] 2.1 Probar generando con una foto real: que los planos 2+ mantengan persona, ropa
      y lugar, y que la animación salga bien. **Lo prueba el usuario.**

## 3. Cerrar

- [ ] 3.1 Pasar el contrato a `openspec/specs/fashion-reel/spec.md`, archivar y anotar
      en decisions-log.
