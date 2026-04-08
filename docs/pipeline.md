# Coevo Studio — Pipeline Reference

## UGC Creator Pipeline (7 steps)

```
1. Script      Gemini generates 4-scene script (or user provides custom script per scene)
               Each scene: script text + visual direction + shot type
2. Base Image  Nano Banana generates Scene 1 from avatar + product + clothing refs
               Composition reference image (optional)
               Positional reference labels for each image
3. Multishot   Generates variations for scenes 2-4 using base as reference
4. Curation    User selects best variation per scene
               Edit panel with product picker available per variation
5. Voice       ElevenLabs generates audio per scene
               Editable text + Play/Regen + uploads to Fal for lipsync
6. Lipsync     HeyGen Avatar 4: image + audio -> talking video per scene
               Uses falUrl from voice step (no re-generation)
7. Render      FFmpeg concatenates all scenes
               Generates both: with subtitles + without subtitles
               Word-by-word karaoke subtitles (Remotion preview)
```

## Video Ad Creator Pipeline (6 steps)

```
1. Script      Gemini generates 10-frame storyboard with voiceover
               Visual style selection (Claymation, Cinematic, etc.)
2. Base Image  Nano Banana generates Frame 1
               Audio preview generated for Frame 1
3. Images      Generates frames 2-10 sequentially (each refs previous)
               Audio generated per frame via ElevenLabs
4. Voice       Audio review per frame: Play/Edit/Regen
5. Animate     Kling V3 Pro frame-to-frame (9 transitions)
6. Render      FFmpeg concat + subtitles
```

## Static Ad Pipeline (2 steps)

```
1. Prompt      Gemini generates ad composition (image prompt + copy)
               40 templates available with detailed prompts
               Editable copy (headline, subline, CTA)
2. Generate    Nano Banana generates base + variations
               Edit panel per image with product picker
```

## Carousel Creator Pipeline (2 steps)

```
1. Prompt      Gemini generates N slides with base_scene (visual DNA)
               8 carousel types with slide structure
               Slide count selector (3-6)
2. Generate    Sequential generation, each slide refs product + slide 1
               Edit panel per slide
```

## PromptBuilder System

```
Template Resolution:
  brand.promptOverrides[toolId]  ->  brand-specific prompt (highest priority)
  tools/{toolId}/default_prompt.txt  ->  default template

Variable Filling:
  {variable_name}  ->  simple replacement
  {?var}...{/var}  ->  conditional block (included only if var is non-empty)

Available Variables:
  {brand_name}, {brand_guidance}, {avatars}, {products}, {clothing},
  {backgrounds}, {voices}, {language}, {product_description},
  {creative_direction}, {video_objective}, {ad_style}, {num_scenes}, etc.
```

## Image Reference Strategy

Nano Banana 2 uses positional image references. Order matters:

### UGC
```
Image 1: Avatar (face/identity)
Image 2: Composition reference (optional pose/setting)
Image 3+: Clothing items
Image N-1: Product (+ extra images if multi-photo)
Image N: Background
```

### Carousel / Static Ad
```
Image 1: Product (always first)
Image 2: Style reference from Slide 1 (slides 2+)
Image 3: Avatar (if scene mentions person)
```

## Response Normalizer

Backend normalizes Gemini output before sending to frontend:

| Gemini returns | Normalized to |
|---|---|
| `audio`, `speech`, `voiceover`, `dialogue`, `action` | `script` |
| `visuals`, `visual`, `setting`, `scene_description` | `image_prompt` |
| `scene_number`, `scene` | `id` |
| `AVATAR: text`, `OFF-CAMERA: text` | `text` (prefix removed) |
| Truncated JSON array | Auto-closed at last `}` |
| Single-key wrapper `{"ad_composition": {...}}` | Inner object extracted |
| Array returned as string | Parsed automatically |

Scoped to `ugc_creator` only in `generate-prompt` endpoint. Other tools have their own parsers.
