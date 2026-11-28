# Spec delta — storyboard

## ADDED Requirements

### Requirement: El storyboard es una entrega
Un storyboard SHALL ser una entrega de tipo `storyboard`, con cuadros numerados (número, clip, tiempo, texto),
rondas, comentarios por cuadro y aprobación por cuadro.

#### Scenario: Aprobar un cuadro
- **WHEN** el cliente aprueba el cuadro #3
- **THEN** sólo el #3 queda aprobado y los demás conservan su estado

#### Scenario: Comentar un cuadro
- **WHEN** alguien comenta el #5
- **THEN** el comentario queda atado a ese cuadro y a la ronda que vio, y su tipo cuenta para las reglas aprendidas de la marca

### Requirement: Reemplazar sin perder la historia
Reemplazar la imagen de un cuadro SHALL guardar la anterior como variante de ese cuadro y SHALL NOT subir la ronda
de toda la entrega.

#### Scenario: Volver a una variante
- **WHEN** se reemplaza el #5 y después se elige la imagen anterior en «Variantes del #5»
- **THEN** el #5 vuelve a mostrar esa imagen y la reemplazada queda como variante

### Requirement: De dónde salió cada cuadro
Si la imagen en uso vino de una mesa, el cuadro SHALL llevar a esa mesa, al grupo de ese número.

#### Scenario: Ir a la mesa
- **WHEN** se toca «Ir a la mesa donde se generó» en el #5
- **THEN** se abre la mesa que la generó, en el grupo del #5
