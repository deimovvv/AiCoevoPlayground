# Tareas — modulos

## 0 · Acordar (con Gonzalo)
- [ ] 0.1 Nombres: «playbook» para el concepto; PDP, Campaña, Motion, Casting, Talking, Retail Kit, Material Lab
- [ ] 0.2 Lista fija de motivos de rechazo
- [ ] 0.3 Visto bueno a la maqueta con el design system de Coevo

## 1 · Cerrar el circuito
- [ ] 1.0 Tablero de Pinterest en Marca › Cómo se ve: pegar el link de un tablero público → `GET /api/brands/{id}/pinterest?url=` lee el `.rss`, baja las imágenes en original y las guarda como referencias de la marca (router propio, todo HTTP por `lib/api.ts`)
- [ ] 1.0b Pedir la app de Pinterest (acceso de prueba, lectura) para conectar cuentas; no bloquea 1.0
- [ ] 1.1 Todas las herramientas visibles mandan lo aprobado a Entregas (hoy: 2 de 19)
- [ ] 1.2 Rechazo con motivo fijo, guardado en la marca
- [ ] 1.3 Tres rechazos con el mismo motivo proponen una regla en Marca › Lo aprendido; una persona la confirma
- [ ] 1.4 Las reglas confirmadas entran al prompt de todos los módulos de esa marca

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
