# /add-tool

Scaffold a new tool for Coevo Creative OS. Usage: `/add-tool <tool_id> <Tool Name> <category>`

Categories: `video`, `images`, `copy`

## Steps

Given the tool_id, name, and category from the user's arguments:

1. Create directory `backend/tools/{tool_id}/`

2. Create `backend/tools/{tool_id}/default_prompt.txt` with this structure:
   ```
   You are a creative AI assistant for {brand_name}.

   {?brand_guidance}
   ━━━ BRAND CONTEXT ━━━
   {brand_guidance}
   {/brand_guidance}

   {?avatars}
   ━━━ AVATARS ━━━
   {avatars}
   {/avatars}

   {?products}
   ━━━ PRODUCTS ━━━
   {products}
   {/products}

   ━━━ YOUR TASK ━━━
   [Describe what this tool generates here]

   ━━━ OUTPUT FORMAT ━━━
   Return ONLY valid JSON. No markdown, no explanation.
   Keys:
   - "image_prompt": string (English only, ultra-detailed)
   - "title": string
   ```

3. Register the tool in `backend/tools/registry.json` — append an entry:
   ```json
   {
     "id": "<tool_id>",
     "name": "<Tool Name>",
     "category": "<category>",
     "description": "Add a description",
     "icon": "sparkles",
     "status": "active",
     "pipeline": ["prompt", "generate", "variations"]
   }
   ```

4. Report: tool created at `backend/tools/{tool_id}/`, registered in registry.json.
   Tell the user to edit `default_prompt.txt` to define the tool's specific generation rules.
