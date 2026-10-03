## ADDED Requirements

### Requirement: Revisar los clips como pieza antes de exportar

Al terminar una tool de video, el usuario SHALL ver todos los clips en un timeline y
reproducirlos en orden antes de exportar.

#### Scenario: Terminar una corrida de Fashion Reel

- **WHEN** termina la animación de todas las escenas
- **THEN** el editor SHALL abrirse con los clips en orden en el timeline
- **AND** el reproductor SHALL permanecer visible mientras se edita

### Requirement: Un comentario corrige sólo ese clip

Un comentario sobre un clip SHALL poder regenerar únicamente ese clip.

#### Scenario: Corregir un clip con un comentario

- **WHEN** el usuario comenta "menos movimiento" sobre el clip 3 y pide regenerarlo
- **THEN** SHALL regenerarse sólo la escena 3
- **AND** el clip nuevo SHALL ocupar el mismo lugar en el timeline
- **AND** la versión anterior SHALL quedar disponible para volver
