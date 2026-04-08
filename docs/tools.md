# Coevo Studio — Tools Reference

15 tools registered. Each uses the 3-layer PromptBuilder system.

## Active Tools

### UGC Creator (video)
**Pipeline:** script -> base_image -> multishot -> curation -> voice -> lipsync -> render
- Talking-to-camera UGC videos with lip-sync
- Custom script per scene (script + visual direction + shot type selector)
- Composition reference image (optional — pose/setting)
- Smart product interaction (phone -> look at screen, clothing -> wear it)
- Voice step with play/edit/regen before lipsync
- Lipsync uses voice step audio directly (no re-generation)
- Dual render: with and without subtitles
- Word-by-word karaoke subtitles (Remotion)
- Positional reference labels for Nano Banana

### Video Ad Creator (video)
**Pipeline:** script -> base_image -> images -> voice -> animate -> render
- Cinematic 10-frame storyboard video ads
- Visual styles: Photorealistic, Claymation, 2D Cartoon, 3D Render, Cinematic, Minimal, Retro
- Frame-to-frame animation with Kling V3 Pro
- Sequential frame generation (each references previous for consistency)
- Voice step with approval before animation
- Audio preview in base_image step

### Static Ad (images)
**Pipeline:** prompt -> generate_all
- Ready-to-publish static ads with copy, product, logo
- 40 ad templates with detailed composition prompts
- Template selector with category filtering
- Generates base + variations
- Editable copy (headline, subline, CTA) with regen

### Carousel Creator (images)
**Pipeline:** prompt -> generate_all
- Multi-slide carousel ads (3-6 slides)
- 8 carousel types: Storytelling, Educational, Before/After, Product Showcase, Testimonial Series, Listicle, Myth Busting, How-To
- base_scene system for visual consistency across slides
- Slide count selector
- Product always first in references

### Ad Creative Lab (images)
**Pipeline:** visual_guide -> prompts -> generate_batch
- Brand-consistent ad creatives from reference images
- Visual guide extraction with Gemini Vision
- Apply style from reference to generated creatives
- Regen + Edit per creative

### Content Analyzer (images)
**Pipeline:** analyze -> adapt -> generate_batch
- Analyze video (upload or URL) with Gemini Vision
- Extract script, scene prompts, visual style
- Adapt content for your brand

### Product Clip (video)
**Pipeline:** script -> base_image -> images -> animate -> render
- Short product videos (10-15s), no people
- Frame-to-frame or image-to-video animation
- Sequential frame generation

### Product Spotlight (images)
**Pipeline:** prompt -> generate -> variations
- Professional product photography in context

### Fashion Editorial (images)
**Pipeline:** prompt -> generate -> variations
- High-end fashion editorial photography

### Fashion Reels (video)
**Pipeline:** script -> base_image -> multishot -> curation -> animate
- Outfit-transition reels

## Planned / Coming Soon

### Photo Multishot (images)
Reuses Product Spotlight handlers. Multiple product photo variations.

### Ad Creative (images)
Reuses Product Spotlight with campaign brief schema.

### Social Post (copy)
Captions and images for social media.

### Reel Creator (video)
Short-form video reels. Coming soon.

### Background Remover (images)
AI background removal. Coming soon.

## Common Features Across Tools

- **ImageEditPanel**: Fix Product, Fix Clothing, Warmer Light, Show Product + product image picker
- **Shot type selector**: Close-up, Medium Close, Medium, Full Body, Wide, Hands, Product Only, Overhead
- **Editable scripts/prompts**: Edit text inline before generation
- **Download**: All generated images/videos downloadable
