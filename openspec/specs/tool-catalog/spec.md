# tool-catalog Specification

## Purpose
Qué cuenta como una "tool" en Coevo Studio y cómo se registra. La clasificación de
las 17 tools contra este criterio está en `docs/tools-audit.md`.

## Requirements

### Requirement: Una tool es un pipeline con pasos que el operador aprueba

Una herramienta SHALL existir como tool sólo si su pipeline tiene al menos un paso
intermedio que el operador revisa y aprueba antes de seguir. Lo que es "llenar
campos y generar" en un solo disparo SHALL ser un preset de Campañas, no una tool.

#### Scenario: Una receta de un solo disparo

- **GIVEN** una herramienta con un único paso y sin aprobaciones (ej. la ex Fashion Editorial)
- **WHEN** se decide dónde vive
- **THEN** SHALL convertirse en preset de Campañas
- **AND** sus fragmentos de prompt SHALL preservarse como presets del sistema en `backend/data/system/`

#### Scenario: Un pipeline al que le faltan aprobaciones

- **GIVEN** una herramienta multi-paso que hoy corre sin aprobaciones (Ecommerce Pack)
- **WHEN** el operador necesita revisar entre pasos
- **THEN** SHALL seguir siendo tool y SHALL sumársele las aprobaciones que le faltan

### Requirement: Registro en dos lados

Cada tool SHALL estar registrada en `frontend/src/tools/registry.ts` (handlers y
pasos que requieren aprobación) y en `backend/tools/registry.json` (orden de pasos).

#### Scenario: Ocultar una tool sin borrarla

- **WHEN** una tool se retira del catálogo
- **THEN** SHALL marcarse `hidden: true` con un `hidden_reason` en `registry.json`
- **AND** SHALL desaparecer de la pantalla Generar sin borrar su código

#### Scenario: Paso registrado de un solo lado

- **WHEN** un handler existe en el frontend pero su paso no está en el pipeline del backend
- **THEN** ese handler nunca se ejecuta y SHALL considerarse código muerto
