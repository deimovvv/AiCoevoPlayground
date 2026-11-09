---
proyecto: AiCoevoPlayground
organismo: Coevo
marca_studio: 
pregunta: ¿Studio puede producir el contenido de cada marca con su memoria guardada, sin rehacer el criterio cada vez?
actualizado: 2026-11-09
---

## Systems
<!-- Nombre | hecho / a medias / falta / no aplica | link al documento | fecha | nota.
     «hecho» sólo con link y fecha (si no, cuenta como a medias). Lo detectado solo queda «a medias»: revisarlo. -->
- Foundation System | a medias | docs/negocio/que-es-coevo-studio.md | 2026-11-09 | qué es Studio; falta el porqué escrito como foundation
- Brand Audit | a medias | docs/negocio/auditoria-coevo-studio.md | 2026-11-09 | hecha desde adentro: vale como hipótesis
- Industry Study | falta |  |  | 
- Market System | a medias | docs/negocio/mapa-de-mercado-coevo-studio.md | 2026-11-09 | 27 jugadores verificados; falta que Gonzalo lo apruebe
- Audience System | falta |  |  | 
- Brand System | falta |  |  | 
- Voice System | falta |  |  | 
- Design System | a medias | frontend/src/index.css | 2026-10-09 | tokens en código; falta el DESIGN.md
- Offer System | a medias | docs/negocio/pricing-credits.md | 2026-10-13 | detectado solo: revisar
- Roadmap System | a medias | docs/negocio/rumbo-2026-2028.md | 2026-10-16 | detectado solo: revisar
- Content System | falta |  |  | 
- Sales System | falta |  |  | 
- Operation System | falta |  |  | 
- Web System | no aplica |  |  | es herramienta interna; la web es de coevo-web
- Care System | falta |  |  | 
- Metrics System | falta |  |  | 

## Decisiones
<!-- AAAA-MM-DD · quién · qué se decidió · (reemplaza: …) — la más nueva arriba -->
- 2026-11-09 · Gonzalo · La herramienta es como Genera (brief, inputs al costado, resultados); los nodos son la vista del equipo. El tablero de Pinterest es clave, sobre todo para Campaña: se importa pegando el link de un tablero público (comprobado: feed .rss, 25 pines, imágenes en original) y queda en Marca. PDP carga una carpeta entera y genera de a una prenda.
- 2026-11-09 · Gonzalo · Las pantallas usan el design system de Coevo (coevo-web/docs/design-system.md) y no muestran nombres de herramientas: se ven módulos. Se llaman playbooks: PDP, Campaña, Motion, Casting, Talking, Retail Kit, Material Lab (a confirmar). Cada uno se ve en nodos con fotos. Sin amarillo.
- 2026-11-09 · Claude (propuesta) · Change `openspec/changes/modulos`: un motor (skill + modulo.json, corre igual desde Studio y desde el chat), todo a Entregas, el rechazo se vuelve regla, pipeline en nodos. Trae el roadmap de Studio en cuatro fases.
- 2026-11-09 · Gonzalo · Producción se ordena en módulos de tres columnas (brief con lo de Marca · lienzo · estilos de la marca), tomando la estructura de Genera.space, no su marca. Maqueta: https://claude.ai/artifact/TmwZbNqejZNEVMqCxi3pb6
- 2026-11-09 · Gonzalo · Los módulos no se construyen de cero: juntan las 19 herramientas que Studio ya tiene (15 escondidas). Lo único que falta es Colores y materiales.
- 2026-11-09 · Gonzalo · Un motor, varias puertas: Coevo Studio es la central; un estudio de moda con nombre propio sería otra puerta al mismo motor, sólo cuando haya marcas pagando por usarlo solas. Morph necesita otro nombre (Morph Studio existe).
- 2026-11-09 · Gonzalo · «Neexis para moda» no se hace aparte (ya existe: CLO-SET AI Visualizer, Style3D). Sí: aceptar un render 3D como entrada de Fotos de producto.
- 2026-11-09 · Gonzalo · Se dice «módulo», no «receta».
- 2026-11-09 · Gonzalo · La Bandeja pide lo que falta en vez de hacer clasificar cada imagen a mano. Marca se lee entera y se edita en el lugar: https://claude.ai/artifact/4EeBQpPVJcCdS9M862ZvKS

## Esta semana
- **Lo que está conectado y lo que no (revisado en el código, 2026-11-09):**
  - Marca → Producción: **sí.** Las 17 herramientas con pantalla leen la marca activa.
  - Producción → Entregas: **casi no.** Sólo 2 de 19 herramientas mandan a Entregas (UGC Creator y Ecommerce Pack). Lo demás se aprueba dentro de la herramienta y ahí queda.
  - Rechazo → regla de la marca: **a medias.** Está la vista de aprendizaje y el MCP clasifica comentarios, pero el motivo de rechazo no se vuelve regla solo.
  - Skills → Studio: **por un solo lado.** Por el MCP, una skill lee la marca, sube entregas y anota costos, pero no puede correr un módulo. Las herramientas de Studio y las skills de coevo-skills hacen el mismo trabajo con código distinto: hay **dos motores**.
  - Tamaño: `backend/main.py` tiene 7.017 líneas y 198 rutas; `ToolRunPage.tsx` unas 15.300.
- **Mapa de mercado (2026-11-09):** video de moda en español ya no es hueco (8 de 12 lo tienen; Curva y Estudio Atlas cobran en pesos). Ninguno de los 12 de moda aprende de los resultados. El más peligroso: Delfi (servicio, cobra por foto aprobada, Falabella/Ripley/Liverpool, app en Tiendanube).
- Maquetas de Marca y de Producción (Koxis) publicadas; Genera.space estudiado módulo por módulo.

## Próximo
- Revisar con Gonzalo el change `openspec/changes/modulos` (nombres, motivos de rechazo, roadmap) y aprobarlo.
- Que todo módulo termine en Entregas, y que tres rechazos con el mismo motivo propongan una regla en Marca.
- Revisar el mapa de mercado: el diferencial pasa de «video en español» (ya lo tienen 8 de 12) a «la memoria que aprende». Mirar Delfi de cerca.
- Ordenar el catálogo de Koxis (52 fotos subidas, catálogo vacío).

## Historial
<!-- ### AAAA-MM-DD y abajo lo que pasó. El estado de arriba se reescribe; esto sólo crece. -->
### 2026-11-09
- Se armó el informe. Reset de Marca, Producción y Bandeja en maquetas; auditoría de Studio (el diferencial es el sistema de criterio).
