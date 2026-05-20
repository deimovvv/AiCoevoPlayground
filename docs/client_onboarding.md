# Onboarding de Cliente — Coevo Studio

Guía interna para vos: qué pedirle a un cliente nuevo para tener su marca 100% cargada en Coevo y poder generar contenido sin fricción.

Está organizado en **tiers**: lo mínimo para arrancar, lo que sube la calidad, y lo que desbloquea features avanzados. Si el cliente solo te da el Tier 1, ya podés generar UGCs decentes — los tiers superiores son para que el contenido se sienta cada vez más "de él".

---

## TL;DR — Lo que SI O SI necesitás del cliente

Pedile estas 4 cosas y arrancás:

1. **Nombre de la marca**
2. **Link al sitio web o IG** (uno alcanza)
3. **1 foto del avatar/embajador** (la persona que aparece en cámara, frontal, buena luz)
4. **1 foto de cada producto principal** (fondo limpio, blanco si se puede)

Con eso entrás a [BrandSettings](#cómo-lo-cargás-en-coevo) y el resto lo extraés con IA en 5 min.

---

## Tier 1 — Mínimo viable (15 min de carga)

Sin esto Coevo no funciona. Si el cliente no te da nada de esto, no podés ni empezar.

### 1.1 Identidad básica

- **Nombre de la marca**
- **Sitio web** o link al **IG principal** (uno de los dos, los dos mejor)
- **1 oración** de qué hace
- **Tono en 3-5 palabras** (ej: "canchero, directo, anti-marketing")

### 1.2 Avatar (la persona que aparece en cámara)

- **Mínimo 1 foto frontal**, buena luz, sin filtros raros
- Idealmente **5-10 fotos variadas**: distintos ángulos, expresiones, ropa
- Si NO hay persona real → podemos generar un avatar sintético con [Avatar Creator tool](tools.md#avatar-creator)

### 1.3 Productos

- **1 foto por producto**, fondo limpio (blanco o neutro)
- Ideal: **3 fotos por producto** (frente, detalle, lifestyle)
- Si vende muchos SKUs → arrancá con los **top 3-5** y después sumás

### 1.4 Contexto de marca

Pegá una de estas tres opciones en BrandSettings → Context:

- **Opción rápida**: la bio del IG + about del sitio + tagline (copy-paste literal)
- **Opción media**: 2-3 párrafos describiendo qué hace, a quién le vende, cómo habla
- **Opción auto**: pegá el link al sitio en "Cargar desde URL" → Gemini scrapea + arma el contexto solo

---

## Tier 2 — Sube la calidad MUCHO (30 min extra)

No son obligatorios pero el contenido se siente 10x más "de la marca" si los tenés.

### 2.1 Background / Locación

- **1-3 fotos del lugar real** donde la marca opera (taller, oficina, depósito, atelier, lo que sea)
- Habilita **Location Anchor**: las escenas usan el fondo real como referencia → consistencia visual entre escenas
- Si no tiene locación física → 1-2 fotos de **moodboard** del vibe visual

### 2.2 Logo

- **PNG con fondo transparente**, idealmente SVG también
- Se mete automático en static ads cuando `includeCopy=true`
- Sin esto los static ads salen sin logo (no es bloqueante pero queda menos pro)

### 2.3 Reviews / Testimonios reales

- **3-5 reviews reales de clientes** (copy-paste literal, con errores y emojis y todo)
- Pueden ser:
  - Comentarios de IG
  - DMs felices
  - Mails de gracias
  - Reseñas de Mercado Libre / Amazon / Google Reviews
- **ORO PURO** porque tienen el lenguaje real del cliente — la IA lo usa para el tone y los hooks

### 2.4 Clothing (solo si aplica)

- Si la marca vende ropa o usa wardrobe específico → fotos de cada prenda, fondo limpio
- Usado en UGC Creator (avatar usa esa ropa) y Fashion Reel

### 2.5 Competidores

- **3 competidores directos** (links a sitio o IG)
- **1 frase por cada uno** de en qué se diferencia tu cliente de ellos
- Se carga en BrandSettings → Competitors
- La IA lo usa para evitar copy genérico y enfatizar diferenciadores

---

## Tier 3 — Voice & Audio (desbloquea UGC con voz propia)

### 3.1 Voice Cloning (recomendado)

Para reemplazar la voz default por una voz **real** que se sienta de la marca:

- **30 segundos a 3 minutos de audio limpio** de la persona hablando natural
- Sin música de fondo, sin eco, sin ruido
- Puede ser:
  - Audio de WhatsApp del cliente
  - Grabación con celu en cuarto silencioso
  - Clip de un IG live / podcast donde aparezca

→ Lo subís en [BrandSettings → Voces → Clonar voz](../frontend/src/pages/BrandSettings.tsx) y queda lista para todas las tools.

### 3.2 Voice Design (alternativa)

Si no hay audio real disponible → describir la voz en texto:

- Género, edad, acento, textura, energía
- Para porteño: importante mencionar **yeísmo rehilado (sh en ll/y)**
- Sirve para personajes ficticios o voces aspiracionales

---

## Tier 4 — Pro / Avanzado

Para clientes con cierto nivel de madurez visual.

### 4.1 Design System manual

Si el cliente ya tiene un brand book:

- **Colores hex** (primario, secundario, acentos)
- **Tipografías** (Google Fonts o archivos)
- **Reglas de uso** (ej: "logo siempre en blanco sobre fondo oscuro")

→ Se carga en BrandSettings → Design System (manual o "Extraer del sitio" si tenés URL)

### 4.2 Moodboards visuales

- **3-10 imágenes** de referencias visuales (no copiar, inspiración)
- Subir en BrandSettings → Moodboards
- Después se pueden seleccionar como referencia visual en static ads y carousels

### 4.3 Business info

- Lista de productos con precios (rangos, no exactos)
- ICP (cliente ideal) detallado
- Canales de venta (web, IG shop, físico)

→ BrandSettings → Negocio (también se auto-extrae con IA del sitio web)

---

## Cómo lo cargás en Coevo

### Flujo recomendado (lo que conviene hacer vos)

```
1. Abrís BrandSettings (sidebar → "Marcas" → click en la marca)
2. ① INPUT  → cargás el sitio web + algunas reviews + brief
3. Click en "Extraer todo con IA" → Gemini te llena:
     - Brand DNA (tone, audience, keywords, personality)
     - Negocio (productos, ICP, canales)
     - Design System (colores, fuentes)
4. ③ ASSETS → subís avatars, productos, clothing, backgrounds, logo, moodboards
5. ④ VOZ → diseñás o clonás la voz que va a usar el avatar
6. (Opcional) ④ FUENTES → si querés tipografías custom para text overlays
```

### El atajo (te ahorra 90% del laburo)

Si tenés URL del sitio del cliente:

```
1. BrandSettings → ① INPUT → Guidance → "Cargar desde URL"
2. Pegás el link → Esperás 30s
3. "Extraer todo con IA"
4. Subís solo avatar + producto
```

Listo. El resto lo armó Gemini scrapeando.

---

## Mensaje plantilla para mandarle al cliente

Versión corta (WhatsApp friendly):

> Hola! Para arrancar con Coevo necesito 3 cosas mínimas:
>
> **1.** Link a tu sitio web o IG
> **2.** 5-10 fotos de la persona que va a aparecer en los videos (frontales, buena luz)
> **3.** Fotos de tus 3-5 productos principales, fondo limpio
>
> Bonus que ayuda muchísimo (mandalo cuando puedas):
>
> - Logo en PNG con fondo transparente
> - 1-2 fotos del lugar donde trabajás (taller / oficina / depósito)
> - 3-5 comentarios o DMs reales de clientes felices, copy-paste literal
> - Si querés que la voz de los videos sea TU voz: un audio de 1-2 min tuyo hablando natural (sin música de fondo)
>
> Con eso ya podemos generar el primer batch de contenido. 🚀

---

## Lo que NO le pidas al cliente

Cosas que parecen útiles pero que la IA extrae mejor sola:

- ❌ Tone & voice analysis detallado → sale del sitio + reviews
- ❌ Personality traits → DNA lo arma solo
- ❌ Buyer persona detallado → Negocio lo extrae del sitio
- ❌ Color palette en hex codes → Design System lo extrae de las imágenes/sitio
- ❌ Tipografías exactas → se detectan del sitio
- ❌ Audience demographics → DNA lo arma
- ❌ Competitive positioning → se infiere de competitors + reviews

Pedí **input concreto** (URL, fotos, audios, reviews crudas). La interpretación la hace la IA.

---

## Checklist final antes de empezar a generar

Una vez que cargaste todo, validá:

- [ ] BrandSettings → Brand Health Card está en verde (no rojo)
- [ ] Brand DNA tiene tone + audience + keywords poblados
- [ ] Al menos 1 avatar con descripción auto-generada
- [ ] Al menos 1 producto con descripción auto-generada
- [ ] Al menos 1 background (si vas a hacer UGC con location anchor)
- [ ] Al menos 1 voz en presets (default o clonada)
- [ ] El sample de TTS suena bien al hacerle play en el panel de Voces

Si todo eso está, andá a [Generar tool](../frontend/src/pages/GeneratePage.tsx) y elegí UGC Creator. Está listo para correr.

---

## Cuando el cliente vuelve con más material

- Más fotos de avatar → BrandSettings → Avatares → upload
- Productos nuevos → BrandSettings → Productos → upload
- Cambió el sitio / agregó info → BrandSettings → Guidance → "Cargar desde URL" otra vez + "Re-extraer DNA"
- Quiere cambiar el nombre de la marca → click en el título de BrandSettings → editar inline
- Nuevas reviews → BrandSettings → Customer Reviews → pegar nuevas

El sistema mantiene todo lo viejo y suma lo nuevo — no pisa nada.
