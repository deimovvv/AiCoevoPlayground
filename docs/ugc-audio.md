# UGC — Audio & voz (LATAM / porteño)

Investigación y decisiones sobre el **audio** de videos UGC talking-head en español LATAM,
con foco en **porteño / rioplatense**. La parte de imagen (Nano Banana, prompting realista,
bajo contraste) ya está resuelta — ver `ecommerce_pack` y `decisions-log`. Esto es sobre la voz.

> Estado: research 2026-07 (verificada con fuentes 2025-26). Incluye un plan de A/B test
> para decidir con datos propios, no solo con lo que dice el mercado.

---

## 1. Hallazgo central: la voz sale del TTS, no del modelo de video

El consenso 2025-26 es claro: los modelos de video con **audio nativo** (Veo 3, Seedance)
**no dan control fino de acento/timbre**. El flujo profesional es **híbrido**: el modelo de
video hace el movimiento de boca / sync, y la **voz de calidad + acento sale de un TTS
dedicado (ElevenLabs)**. Para control de acento, ElevenLabs v3 gana lejos.

**Consecuencia para porteño:** el acento es control fino → la voz **siempre** de ElevenLabs.

## 2. ⚠️ Seedance NO preserva tu audio (el dato que cambia todo)

Seedance 2.0 acepta audio de referencia, PERO **no conserva tu track**: si le subís una
narración, *"el modelo NO la preserva y genera audio NUEVO que comparte el timing y mood"*.

**O sea:** pasarle tu voz porteña de ElevenLabs a Seedance = la usa de referencia de timing
y **regenera la voz con la suya** → **perdés el acento**. Seedance sirve para
b-roll/ambiente autogenerado, **no** para preservar una voz específica.

Su audio nativo: ambiente 70-80% listo, voz/música 50-60% ("suena AI"). Lip-sync a nivel
fonema en ~8 idiomas (incl. español), pero en idiomas de menor representación **el acento
drifta**.

## 3. Voz porteño / LATAM → ElevenLabs + cloning

- ElevenLabs tiene **voces porteñas** (Malena, Agustín, Melanie) y **cloning que retiene el
  acento** en todos sus idiomas.
- **Camino confiable para porteño auténtico** (el "sh", voseo, entonación): **clonar un
  hablante porteño real** > presets genéricos.
- Otras zonas LATAM (mexicano, colombiano, chileno): presets o clone por región.
- Usar **Eleven v3** + audio tags para tono/emoción (clave en UGC: humano, no locutor).

## 4. Lip-sync / video (dónde va tu audio — y lo preserva)

Modelos que sincronizan a TU audio **sin regenerarlo** (a diferencia de Seedance):
- **Hedra Character-3** — benchmark 2025-26 de talking-photo (sync 9/10, 140+ idiomas,
  realismo facial + micro-expresiones). **No wired** — candidato a integrar.
- **HeyGen** — multilingüe sólido (40+ idiomas). **Ya wired.**
- **Fal Fabric** — lip-sync básico. **Ya wired.**
- **Sync.so** — escala/API (miles de videos).

## 5. Ambiente: se agrega en la mezcla (y es lo profesional)

ElevenLabs da **voz limpia, sin ambiente**. Eso es bueno: control total. El ambiente
("UGC auténtico") se suma como una **cama de room-tone + fondo de escena** (café, calle,
casa) debajo de la voz — 1 capa en la mezcla, controlada, mejor que la que autogenera el
modelo. Se puede automatizar.

## 6. Pipeline recomendado

```
1. GUION    → texto en porteño (voseo, léxico rioplatense: "che", "dale", "posta")
2. VOZ      → ElevenLabs v3, voz porteña CLONADA (o preset), limpia + audio tags
3. SYNC     → Fal Fabric / HeyGen / Hedra  (preserva TU voz)   ← NO Seedance para hablado
4. AMBIENTE → cama de room-tone + fondo de escena, en la mezcla
```

Seedance queda para **escenas sin diálogo específico** (b-roll con ambiente+SFX auto).

**Regla de oro:** el 80% del resultado es la voz. Cloná porteño real, escribí voseo, y que
el modelo de video **solo sincronice**. El acento nunca se lo confíes al modelo de video.

## 7. Costos (referencia)

- ElevenLabs voz: ~centavos por clip.
- Seedance ref-to-video: ~$0.30/s (720p), baja a ~$0.18/s con video de referencia.
- Hedra: costo extra (no wired).

## 8. 🧪 A/B TEST — decidir con datos propios

No asumir: probar los dos y comparar. Mismo guion porteño corto (~8s), misma imagen base.

- **Método A — ElevenLabs → lip-sync:** voz porteña de ElevenLabs → Fal Fabric (o HeyGen).
- **Método B — Seedance nativo prompteado:** Seedance con el diálogo + prompt explícito de
  acento (ej. *"speaks in a natural Buenos Aires Argentine (rioplatense) accent, voseo,
  porteño intonation"*).

**Evaluar (1-5 cada uno):**
| Criterio | A (ElevenLabs+sync) | B (Seedance nativo) |
|---|---|---|
| Autenticidad del acento porteño | | |
| Calidad/naturalidad de voz | | |
| Precisión de lip-sync | | |
| Ambiente (o falta) | | |
| Costo | | |
| Control (repetible / editable) | | |

**Hipótesis:** A gana en acento y control; B puede ganar en "ambiente listo" pero perder
en acento. Confirmar con el test — y re-testear cuando salgan versiones nuevas.

## 9. Mapeo a Coevo (qué está wired hoy)

- ElevenLabs (TTS + cloning): ✅ — falta crear/clonar una **voz porteña**.
- Seedance 2.0 ref-to-video (`audioUrls`): ✅ — OJO: el comentario del código dice que
  *"reemplaza HeyGen/Fal lipsync para escenas habladas"*. Si Seedance regenera la voz, esa
  ruta **pisa la voz de ElevenLabs** → revisar el ruteo del UGC para escenas habladas.
- Fal Fabric lip-sync: ✅ · HeyGen: ✅ · Hedra: ❌ (a evaluar como motor premium).

## Fuentes
- ElevenLabs: [Argentine accent](https://elevenlabs.io/text-to-speech/argentine-accent) · [LATAM](https://elevenlabs.io/text-to-speech/latin-american-accent)
- Native vs TTS+lipsync: [skywork (Veo 3)](https://skywork.ai/blog/how-to-prompt-lip-synced-dialogue-google-veo-3/) · [GlobalGPT](https://www.glbgpt.com/hub/how-to-make-characters-speak-in-veo-3-1-the-ultimate-guide-to-dialogue-audio-lip-sync/)
- Lip-sync ranking: [magichour](https://magichour.ai/blog/best-ai-lip-sync-tools) · [HeyGen vs Hedra](https://lipsync.com/compare/heygen-vs-hedra)
- Seedance audio: [seedance2pro — no preserva el audio](https://seedance2pro.io/blog/does-seedance-2-accept-voice-reference) · [ugccopilot](https://ugccopilot.ai/blog/seedance-2-native-audio-generation-guide/) · [kensa](https://www.kensa.cc/blog/seedance-2-0-audio-generation-guide)
