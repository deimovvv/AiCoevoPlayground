## 0. Decidir

- [x] 0.1 Confirmar los tres niveles (imagen · animar pieza · video largo por tool). Usuario, 2026-10-03.

## 1. Video corto

- [ ] 1.1 Botón "Animar" en una pieza de imagen aprobada de la campaña.
- [ ] 1.2 El clip resultante entra como pieza nueva (`type: "video"`), sin pisar la imagen.

## 2. Video largo

- [ ] 2.1 Cada toma del plan declara qué tool la ejecuta (`fashion_reel`, `ecommerce_pack`,
      `ugc_creator` o generación directa). El planner ya conoce el catálogo de la marca;
      le falta el de tools.
- [ ] 2.2 Cuando el planner devuelve `needs_video: true`, ofrecer "Agregar video" en vez de sólo avisar.
- [ ] 2.3 La tool abre con brief, modelo, prendas y look de la campaña precargados.
- [ ] 2.4 Al exportar, la pieza vuelve a la campaña de origen (usar `campaign.generationIds`).

## 3. Spec

- [ ] 3.1 Reescribir `openspec/specs/campaigns/spec.md` desde el código actual
      (`docs/archive/campaigns.md` es el spec original, obsoleto).
