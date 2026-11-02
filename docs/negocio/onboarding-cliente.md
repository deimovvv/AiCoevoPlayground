# Onboarding de un cliente de Coevo Studio (2026-10-28, propuesta)

> Gonzalo, 2026-10-28: *"cómo sería el proceso de un onboarding con los clientes: qué les responderíamos, qué
> les pediríamos"*. Sirve para **cualquier marca** (empresa mediana, cualquier rubro); moda es un caso más.
> Reemplaza a [client_onboarding.md](client_onboarding.md), que es la guía vieja para cargar una marca en las tools.
> Cobro y planes: [modelo-de-negocio.md](modelo-de-negocio.md). En la app: tareas M.3 y M.14 de `studio-v2`.
> **El orden del recorrido y las dos puertas se deciden en `coevo-web/docs/recorrido-cliente.md`, que manda.** Acá va el detalle de cada paso.

## El recorrido: nosotros proponemos, el cliente corrige (2026-11-01)

El cliente no recibe una lista de tareas. Leemos su marca, proponemos y sólo nos corrige. **Esta es la única numeración.**

En la charla (paso 2) se define la puerta. **Studio:** pasos 1, 2, 8, 9, 10 y 11, sin auditoría obligatoria. **Consultoría:** pasos 1 a 7, y del 8 en adelante sólo si contrata algo más.

| # | Paso | Dueño | Qué hace el cliente | Se cobra |
|---|---|---|---|---|
| **Para todos** | | | | |
| 1 | Formulario, sólo si llega solo ([formulario-inicial.md](formulario-inicial.md)). Si lo buscamos, lo leemos nosotros | Gonzalo | Responde | |
| 2 | Lectura corta y charla de 30 min: sale sabiendo algo nuevo de su marca y se define la puerta | Gonzalo + agente | Conversa | Gratis |
| **Puerta Consultoría** | | | | |
| 3 | Contrata la auditoría integral | Gonzalo | Decide | **Precio fijo, antes de empezar** |
| 4 | Auditar lo que existe, área por área. Skills: `auditoria-creativa` → `mapa-de-mercado` → `spec-campana` | Agente + Keila (a confirmar) | Nada | |
| 5 | Armar «Así los entendemos» y qué haríamos primero | Gonzalo + agente | Nada | |
| 6 | Buscar 15 referencias, con el motivo de cada una | Keila (a confirmar) | Nada | |
| 7 | Presentación: corrige, dice sí o no a cada referencia y elige qué áreas contrata | Gonzalo | Corrige y elige | |
| **Puerta Studio** (o lo que contrate después de la auditoría) | | | | |
| 8 | Pedir sólo lo que falta e invitar al portal | Gonzalo | Responde | **Arranque (USD 300), antes de empezar** |
| 9 | Cargar la ficha en Studio, con el sí de Gonzalo | Claude; valida Gonzalo | Nada | |
| 10 | Definir formatos y hacer un piloto de cada uno | Equipo | Aprueba | |
| 11 | Arranca el plan o el proyecto, con reunión semanal y primer reporte a las 4 semanas | Equipo | Aprueba las piezas | Plan o proyecto |

- **Lo gratis es la lectura corta del paso 2.** La auditoría completa se cobra, pero no es requisito para un plan de Studio. No se hacen pilotos sin pagar el arranque (decidido por Gonzalo, 2026-11-01).
- **En la puerta Studio,** «Así los entendemos» y las referencias se hacen dentro del arranque (pasos 8 y 9).
- **Auditoría propia:** si la marca ya tiene una, vale si trae diagnóstico, mercado y estrategia. Se carga en Studio y no se rehace.
- **Marca nueva, sin nada público:** no hay qué auditar. El paso 4 pasa a ser mapa de mercado y posicionamiento. Ver la prueba con Cocucci más abajo.
- **Socios o proyectos propios:** no aplican llamada, precios ni cobro.
- Sin pilotos aprobados no hay plan.
- **Primera prueba:** ALGÜNA, con su equipo como clientas.

### Las cinco áreas: la misma narrativa en toda marca (propuesta)

Toda marca se cuenta en el mismo orden: **quién es → qué miramos en cada área → qué haríamos primero → qué contrató → cómo viene**.

| Área | Qué miramos | Qué puede seguir |
|---|---|---|
| Estrategia | Visión, a quién le vende, en qué se diferencia | Plan y prioridades |
| Marca | Identidad, voz, coherencia | Design system |
| Contenido | Redes y piezas | Plan mensual o proyectos |
| Web | Si explica y si vende | Web nueva o mejoras |
| Tecnología y operación | Ventas, stock, logística, tareas repetidas | Sistemas a medida |

Studio guarda esta memoria y los links; la operación de cada negocio vive en su sistema.

**Sin desarrollar todavía:** cómo se le dice al cliente qué nos da y qué no, el formulario, la definición de formatos y cómo se ven las áreas en Studio. Las skills se deciden en coevo-skills y la oferta en coevo-web.

### Cómo validamos al cargar una marca (Gonzalo y Claude)

1. **Gonzalo pasa las fuentes:** link de la web, capturas o exportación de Instagram (nunca una sesión), documentos.
2. **Claude lee y muestra una propuesta,** campo por campo: qué cargaría, de dónde salió y qué tan seguro está.
3. **Gonzalo responde sí, no o cambiá esto.** Nada se carga antes de ese sí.
4. **Lo dudoso no se carga como hecho:** queda como pregunta para el cliente.
5. **Claude carga y Gonzalo lo mira en «Perfil»,** como lo ve el cliente. La marca está lista cuando Gonzalo lo da por bueno.

## Qué les pedimos (paso 8, sólo lo que falte)

**Antes de armar la lista, revisar qué material ya tenemos** y pedir sólo lo que falta.

Todo entra por **«Mandar algo»** en el portal o por un link que les mandamos; nada por WhatsApp suelto. Antes de pasar el link del portal, invitar al cliente desde Accesos.

| Qué | Para qué | Si no lo tienen |
|---|---|---|
| **Logo** (vectorial o PNG sin fondo) y **tipografías** | Que cada pieza sea de la marca | Lo armamos (se cotiza aparte) |
| **Manual o PDF de marca**, piezas que les gustaron y que no | Identidad, siempre y nunca | Sale de la auditoría |
| **Referencias:** las proponemos nosotros (paso 6) y dicen sí o no. Si ya tienen un tablero, lo sumamos | Que no adivinemos el gusto de la marca | Seguimos igual: no frena el arranque |
| **Productos o servicios:** fotos, datos, precios si se publican | Las piezas de catálogo | Guía de fotos por rubro (`pipeline-contenido/rubros/`, `ficha-ecommerce` para moda) |
| **La persona a cámara:** alguien del equipo (con permiso escrito de esa persona, también para su voz) o elegimos una creada | Los videos con presentador | Creamos una (`avatar-sheet`) |
| **Lugar:** fotos del local, la oficina, el showroom | Que se vea que es real | Usamos material de la marca |
| **Reglas:** palabras que no usan, temas que no tocan, competidores que no se nombran, lo legal | Que no se repita un error (M.13) | Las proponemos y las aprueban |
| **Quién aprueba**, su suplente y en cuánto tiempo responde | Que las piezas no se traben | Por defecto, una persona y 48 h |
| **Accesos:** Meta Business (para publicar) · GA4 si tienen web · cuenta publicitaria si suman pauta | Publicar y medir | Los creamos con ellos en la llamada |
| **Los números de hoy:** 2 o 3 acordados con el cliente, según el rubro (consultas por mes, ventas, visitas). Si su operación vive en otro sistema, sus datos no entran a Studio: sólo estos números | La línea base del reporte | Los medimos el primer mes y se avisa |
| **Competidores** que miran | La auditoría y la estrategia | Los buscamos nosotros |

**Lo que no les pedimos:** que escriban textos, que piensen ideas, que aprendan una herramienta, que manden
material en alta si no lo tienen. El trabajo es nuestro.

## Qué les respondemos (mensajes fijos)

Los mandamos siempre igual; cambian el nombre y los datos. Van a vivir en la skill `onboarding-marca` (M.3).

1. **Después de la llamada:** «Gracias por la charla. Te resumo lo que entendimos: [3 líneas]. El próximo paso
   es la auditoría: en [n] días te mostramos cómo se ve tu marca de afuera, qué hace tu competencia y qué
   haríamos los próximos tres meses. Cuesta [precio] y se descuenta del arranque si seguimos.»
2. **Presentación (paso 7):** «Armamos cómo los entendemos y unas referencias para la próxima etapa. ¿Nos juntamos 15
   minutos esta semana? Ustedes sólo nos dicen qué está mal.»
   **Después de la presentación (paso 8):** «Para seguir nos falta esto: [sólo lo que falta]. Lo podés subir acá: [link].
   Si algo no lo tenés, no pasa nada: lo resolvemos nosotros.»
3. **Accesos:** «Para publicar y medir necesitamos que nos sumes como socio en Meta Business. Te dejamos los
   pasos: [3 pasos]. Nunca te pedimos contraseñas.»
4. **Pilotos listos:** «Ya podés ver los primeros pilotos en tu portal: [link]. Tocá la pieza para comentar en el
   punto exacto, o aprobala. Cuando estén todos aprobados, arranca el plan.»
5. **Cómo trabajamos:** «Cada semana te llegan las piezas al portal; las aprobás desde el celular. Los martes
   [día] nos vemos una hora. A fin de mes te llega el reporte con lo que trajo cada pieza.»

## Lo que tiene que estar listo antes del plan (la lista del arranque)

En Studio, la lista de Marca (M.14) muestra esto con su estado; el cliente ve lo suyo y nosotros todo.

- [ ] Quién es la marca, en una frase, aprobada por el cliente
- [ ] Identidad: logo, colores, tipografías (y el design system, para nosotros)
- [ ] Reglas: siempre y nunca
- [ ] Productos o servicios cargados
- [ ] La persona a cámara, con permiso escrito si es real
- [ ] Quién aprueba
- [ ] Accesos: Meta Business (y GA4 / Ads si aplica)
- [ ] Línea base: los 2 o 3 números de hoy
- [ ] Un piloto aprobado de cada formato

## Prueba con Cocucci Automotores: lo que no sirvió (2026-11-01)

Marca nueva, sin presencia pública y con Gonzalo como socio. Sólo se hizo hasta las direcciones visuales.

- **Falta el camino de marca nueva.** Las etapas suponen una marca que ya existe. Acá fue: mapa de mercado y posicionamiento → 2 o 3 direcciones → design system. Sin eso, la lista del arranque no se puede empezar.
- **Auditoría (paso 4):** no hay qué auditar sin marca pública. El paso `auditoria-creativa` no aplica; `mapa-de-mercado` sí, pero la skill dice que va «después» de la auditoría.
- **Llamada, precios y cobro por etapa:** no aplican a un socio. Hace falta otra forma de decidir y aprobar, porque el que encarga también es parte.
- **«Logo: lo armamos, se cotiza aparte»:** en una marca nueva el logo no es un extra. El design system lo deja «a definir», así que hay que decir quién lo hace y cuándo.
- **«Lugar: fotos del local»:** el galpón está en obra. Hay que pedir plano, medidas y orientación mientras todavía se pueden cambiar la pintura y la luz, y filmar la obra.
- **«Referencias» se pide en el arranque y «no frena»:** en una marca nueva define las direcciones, así que debería venir antes. Acá las direcciones salieron antes de recibir el tablero de Pinterest.
- **«Línea base: los números de hoy»:** un negocio sin abrir no tiene números. Conviene medir al competidor (ej.: consultas de un aviso igual en portal) o arrancar la cuenta el primer día.
- **Accesos y portal:** no hay Meta Business ni marca en Studio todavía; los pasos 8 y 9 no se probaron.
- **Conflicto entre clientes:** no está previsto. Cocucci Automotores compite con Giumati, cliente de Coevo en Mendoza. Hace falta una pregunta fija al abrir una marca: ¿compite con otro cliente?

## Pendiente

- Precio de la auditoría y si se descuenta (ver modelo-de-negocio.md).
- Probar el recorrido entero con ALGÜNA y Cocucci Automotores (y con la primera concesionaria *design partner*) y corregir este doc con lo que pase.
- Pasar los mensajes y la lista a la skill `onboarding-marca` cuando se haya hecho dos veces.
