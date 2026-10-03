# Coevo Studio — Pipeline Reference

## UGC Creator Pipeline (6 steps)

```
1. Script      Gemini generates 4-scene script (or user provides custom script per scene)
               Each scene: script text + visual direction + shot type
2. Base Image  Nano Banana generates Scene 1 from avatar + product + clothing + moodboard refs
               Composition reference image (optional)
               Positional reference labels for each image
3. Multishot   Generates variations for remaining scenes using base as reference
               User selects best variation per scene (inline in multishot step)
4. Voice       ElevenLabs generates audio per scene
               Editable text + Play/Regen + uploads to Fal for lipsync
5. Lipsync     HeyGen Avatar 4: image + audio -> talking video per scene
               Uses falUrl from voice step (no re-generation)
6. Render      FFmpeg concatenates all scenes
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
5. Animate     Kling frame-to-frame (9 transitions)
6. Render      FFmpeg concat + subtitles
```

## Fashion Reel Pipeline (5 steps)

```
1. Script      Story mode: Gemini generates 4-scene arc (Hook/Movement/Showcase/Closer)
               Looks mode: generates scenes directly from selected clothing items (no Gemini)
2. Base Image  Nano Banana generates first scene with avatar + clothing + moodboard refs
3. Multishot   Generates remaining scenes, each with per-scene clothing selection
4. Animate     Kling image-to-video per scene with motion prompts
5. Render      FFmpeg concat — no subtitles, no voice
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

## Content Analyzer Pipeline (3 steps)

```
1. Analyze     Upload video file or paste URL (TikTok, YouTube, Instagram)
               Gemini Vision: extract script, scenes, visual style, camera work, pacing
               content_type detection: UGC | dance | movement | editorial | lifestyle | cinematic | etc.
2. Adapt       Gemini adapts content for your brand
               Replaces product/avatar/clothing references, keeps structure
               Generates per-scene image prompts + adapted script
3. Route       Scene preview panel (script + image prompt per scene)
               Auto-suggests destination tool based on content_type + isVisualOnly detection
               Launch destination → all data + assets transfer via sessionStorage
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

### UGC / Fashion Reel
```
Image 1: Avatar (face/identity)
Image 2: Composition reference (optional pose/setting)
Image 3+: Clothing items
Image N-1: Product (+ extra images if multi-photo)
Image N-1: Background
Image N: Moodboard (visual style reference — if selected)
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
