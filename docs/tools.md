# Coevo Studio — Tools Reference

11 active tools. Each uses the 3-layer PromptBuilder system.

## Active Tools

### UGC Creator (video)
**Pipeline:** script → base_image → multishot → voice → lipsync → render
- Talking-to-camera UGC videos with lip-sync
- Custom script per scene (script + visual direction + shot type selector)
- Composition reference image (optional — pose/setting)
- Smart product interaction (phone → look at screen, clothing → wear it)
- Voice step with play/edit/regen before lipsync
- Lipsync uses voice step audio directly (no re-generation)
- Dual render: with and without subtitles
- Word-by-word karaoke subtitles (Remotion)
- Positional reference labels for Nano Banana
- Handoff from Content Analyzer: custom script pre-loaded with adapted scenes + assets pre-selected

### Video Ad Creator (video)
**Pipeline:** script → base_image → images → voice → animate → render
- Cinematic 10-frame storyboard video ads
- Visual styles: Photorealistic, Claymation, 2D Cartoon, 3D Render, Cinematic, Minimal, Retro
- Frame-to-frame animation with Kling
- Sequential frame generation (each references previous for consistency)
- Voice step with approval before animation
- Audio preview in base_image step

### Fashion Reel (video)
**Pipeline:** script → base_image → multishot → animate → render
- Visual fashion/lifestyle reels — no talking, pure movement
- **Story mode**: 4-scene narrative (Hook → Movement → Showcase → Closer), one look
- **Looks mode**: one scene per outfit — each clothing item = one look in the reel
- All scenes are "creative" type (no lipsync, no voiceover)
- Kling image-to-video per curated frame
- Visual styles: Editorial, Cinematic, iPhone, Studio
- Composition reference support (optional pose/setting)
- Handoff from Content Analyzer: scene prompts + assets pre-loaded for visual-only content
- Auto-suggested by Content Analyzer when content_type is dance/transformation/movement

### Product Clip (video)
**Pipeline:** script → base_image → images → animate → render
- Short product videos (10-15s), no people
- Frame-to-frame or image-to-video animation
- Sequential frame generation

### Content Analyzer (images → routes to other tools)
**Pipeline:** analyze → adapt → route
- Analyze any video (upload file or URL) with Gemini Vision
- Supported sources: TikTok (via tikwm.com), YouTube, Instagram, direct file upload
- Extract script, scene structure, visual style, camera work, pacing
- Adapt content for your brand: replace product/avatar/clothing, keep what works
- **Route panel**: scene preview (script + image prompt per scene) then choose destination tool
  - Suggested tool auto-detected from content type (dance/movement → fashion_reel, UGC → ugc_creator, etc.)
  - All adapted data + asset selections transfer automatically to destination via sessionStorage
- **TikTok Profile mode**: paste `@username` URL → scrape top 10 videos by engagement rate (requires APIFY_API_KEY)
  - Shows thumbnail, description, likes/comments/shares/plays, engagement %
  - Select a video → auto-fills URL for analysis
- Background selection transfers through handoff to destination tool

### Static Ad (images)
**Pipeline:** prompt → generate_all
- Ready-to-publish static ads with copy, product, logo
- 40 ad templates with detailed composition prompts
- Template selector with category filtering
- Generates base + variations
- Editable copy (headline, subline, CTA) with regen
- Handoff from Content Analyzer: creative direction + style notes pre-loaded

### Carousel Creator (images)
**Pipeline:** prompt → generate_all
- Multi-slide carousel ads (3-6 slides)
- 8 carousel types: Storytelling, Educational, Before/After, Product Showcase, Testimonial Series, Listicle, Myth Busting, How-To
- base_scene system for visual consistency across slides
- Slide count selector
- Product always first in references
- Handoff from Content Analyzer: scene outline pre-loaded as brief

### Ad Creative Lab (images)
**Pipeline:** visual_guide → prompts → generate_batch
- Brand-consistent ad creatives from reference images
- Visual guide extraction with Gemini Vision
- Apply style from reference to generated creatives
- Regen + Edit per creative
- Handoff from Content Analyzer: full adapted script + visual style + scene prompts pre-loaded as creative direction

### Product Spotlight (images)
**Pipeline:** prompt → generate → variations
- Professional product photography in context
- Moodboard visual style reference support

### Fashion Editorial (images)
**Pipeline:** prompt → generate → variations
- High-end fashion editorial photography
- Avatar + garments + pose direction with professional lighting and styling
- Moodboard visual style reference support

### Avatar Creator (images)
**Pipeline:** brief → generate → save
- Generate AI avatars tailored to your brand's audience
- Style selection + optional direction
- Gemini generates character brief from brand context
- Saves avatar directly to brand kit

## Coming Soon

### Reel Creator (video)
Short-form video reels with scenes, music, and subtitles.

### Background Remover (images)
AI background removal from product photos.

## Common Features Across Tools

- **Moodboard**: visual style reference image — one active per tool, transfers on Content Analyzer handoff
- **ImageEditPanel**: Fix Product, Fix Clothing, Warmer Light, Show Product + product image picker
- **Shot type selector**: Close-up, Medium Close, Medium, Full Body, Wide, Hands, Product Only, Overhead
- **Editable scripts/prompts**: Edit text inline before generation
- **Download**: All generated images/videos downloadable
- **Content Analyzer handoff**: any tool can receive adapted data + asset pre-selection from Content Analyzer
- **Sandbox brand**: always available for quick generation without a client brand

## External Services

| Service | Used for | Auth |
|---------|----------|------|
| tikwm.com | TikTok video download (no auth) | None |
| Apify (clockworks/tiktok-scraper) | TikTok profile scraping, top-video ranking | APIFY_API_KEY |
| Gemini 2.5 Flash | Video analysis, script adaptation, prompt generation | GEMINI_API_KEY |
| Nano Banana 2 (Fal) | Image generation & editing | FAL_KEY |
| Kling (Fal) | Image-to-video animation | FAL_KEY |
| ElevenLabs v3 | TTS, voice cloning | ELEVENLABS_API_KEY |
| HeyGen Avatar 4 (Fal) | Lip-sync from image + audio | FAL_KEY |
| Fal Fabric 1.0 | Lip-sync (alternative) | FAL_KEY |
