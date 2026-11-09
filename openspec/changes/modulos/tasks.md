# Tareas — modulos

## 0 · Acordar (con Gonzalo)
- [ ] 0.1 Nombres: «playbook» para el concepto; PDP, Campaña, Motion, Casting, Talking, Retail Kit, Material Lab
- [ ] 0.2 Lista fija de motivos de rechazo
- [ ] 0.3 Visto bueno a la maqueta con el design system de Coevo

## 1 · Cerrar el circuito
- [x] 1.0 Tablero de Pinterest en Marca (2026-11-09). Ya existía (`backend/routers/importar.py`, studio-v2 M.6); se sumó: imágenes en original achicadas a 2048 px, descarga en paralelo, sin duplicados (cada imagen guarda su `pin`), «Actualizar» por tablero que trae sólo los pines nuevos, destino pose, y la marca se relee después de bajar (no pisa cambios hechos mientras tanto). Probado con un tablero público real.
- [ ] 1.0b Pedir la app de Pinterest (acceso de prueba, lectura) para conectar cuentas; no bloquea 1.0
- [x] 1.1 Lo producido llega a Entregas (2026-11-09): en Producción, «Listo para Entregas» lista las corridas terminadas de los últimos 30 días y cada una se manda con un botón (`POST /api/generations/{id}/deliver`). Copia las piezas (archivo local, imagen embebida o link de Fal) a la entrega interna y anota en la corrida a qué entrega fue: mandar dos veces da la misma. Sirve para todas las tools sin tocarlas.
- [x] 1.2 Rechazo con motivo: ya existía en Entregas (brand-integrations §4): cada comentario tiene tipo (texto, color, encuadre, tono, dato, imagen, otro). Falta, para la pantalla nueva, la lista propia de moda (calce, cara, color de la prenda, luz, fondo, pose): va con la fase 2.
- [x] 1.3 Tres con el mismo motivo proponen una regla: ya existía (Entregas → Aprendizaje → «Hacer regla»; se guarda en `brand.learnedRules`).
- [x] 1.4 Las reglas entran al prompt de las tools (2026-11-09): `buildBrandContext` suma «BRAND RULES LEARNED…» (UGC, Video Ad, Fashion Reel, Static Ad, Carousel). Falta Ecommerce Pack, que arma su prompt aparte: va con PDP en la fase 2.

## 2 · Un motor
- [ ] 2.1 Formato `modulo.json` (casilleros, cadena, costo, herramientas que reemplaza) en `coevo-skills`
- [ ] 2.2 El `modulo.json` se convierte en `graph.json` del motor de nodos (`backend/nodes/`)
- [ ] 2.3 Router `backend/routers/modulos.py`: correr, estado del trabajo, resultado → Entregas
- [ ] 2.4 MCP: `correr_modulo(marca, modulo, brief)`
- [ ] 2.5 Vitrina corre por el motor (envolviendo Ecommerce Pack)
- [ ] 2.6 Pasarela corre por el motor (envolviendo Fashion Reel)
- [ ] 2.7 Pantalla de tres columnas en `components/workspace/`, con el grafo del módulo a la vista

## 3 · Cerrar el change
- [ ] 3.1 Contrato a `openspec/specs/modules/`; carpeta a `changes/archive/`
- [ ] 3.2 Guía de prueba para Gonzalo en `docs/guias/`
