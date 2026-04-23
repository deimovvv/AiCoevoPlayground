"""
PromptBuilder Service
─────────────────────
Three-layer prompt assembly system:

  Layer 1: Tool Default Template   → backend/tools/{tool_id}/default_prompt.txt
  Layer 2: Brand Override          → brand data (optional per brand×tool)
  Layer 3: Dynamic Brand Context   → injected variables from brand assets/config

The PromptBuilder resolves which template to use (brand override or default),
then fills in template variables with the brand's dynamic context.
"""

import os
import re
from pathlib import Path
from typing import Optional, Dict, List

TOOLS_DIR = Path(__file__).parent.parent / "tools"


# ── Template Variable Builders ──────────────────────────────────

def _format_asset_list(items: list, label: str) -> str:
    """Format a list of assets into a prompt section. Returns empty string if no items."""
    if not items:
        return ""

    lines = []
    for item in items:
        name = item.get("name", "Unnamed")
        desc = item.get("description", "")
        tags = item.get("tags", [])

        line = f"- {name}"
        if desc:
            line += f": {desc}"
        if tags:
            line += f" [{', '.join(tags)}]"
        lines.append(line)

    return f"{label}:\n" + "\n".join(lines)


def _format_design_system(ds: dict) -> str:
    """Format brand design system for injection into image/video prompts. Empty string if none."""
    if not ds:
        return ""

    parts = []
    if ds.get("photoStyle"):
        parts.append(f"Photography style: {ds['photoStyle']}")
    if ds.get("composition"):
        parts.append(f"Composition: {ds['composition']}")
    if ds.get("colorTreatment"):
        parts.append(f"Color treatment: {ds['colorTreatment']}")
    if ds.get("lighting"):
        parts.append(f"Lighting: {ds['lighting']}")
    if ds.get("visualDos"):
        parts.append("Always show:\n" + "\n".join(f"- {x}" for x in ds["visualDos"]))
    if ds.get("visualDonts"):
        parts.append("Never show:\n" + "\n".join(f"- {x}" for x in ds["visualDonts"]))
    if ds.get("references"):
        parts.append(f"Visual references: {ds['references']}")

    if not parts:
        return ""
    return "BRAND DESIGN SYSTEM:\n" + "\n\n".join(parts)


def build_context_variables(brand: dict, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """
    Build the full dictionary of template variables from brand data.
    These variables can be referenced in prompt templates as {variable_name}.
    Only populated variables will have content; empty ones get "".
    """
    variables = {
        # Core
        "brand_name": brand.get("name", "Unknown"),
        "brand_guidance": brand.get("brandContext", "").strip(),

        # Assets
        "avatars": _format_asset_list(brand.get("avatars", []), "AVAILABLE AVATARS"),
        "clothing": _format_asset_list(brand.get("clothing", []), "WARDROBE / CLOTHING"),
        "products": _format_asset_list(brand.get("products", []), "PRODUCTS"),
        "backgrounds": _format_asset_list(brand.get("backgrounds", []), "BACKGROUNDS / SCENES"),

        # Voice presets
        "voices": "",

        # Design system (for image/video tools)
        "design_system": _format_design_system(brand.get("designSystem", {})),
    }

    # Voice presets
    voices = brand.get("voicePresets", [])
    if voices:
        voice_lines = [f"- {v.get('name', v.get('id', ''))}" for v in voices]
        variables["voices"] = "VOICE PRESETS:\n" + "\n".join(voice_lines)

    # Merge any extra variables (tool-specific or user-provided)
    if extra:
        variables.update(extra)

    return variables


# ── Template Resolution ─────────────────────────────────────────

def _load_default_template(tool_id: str) -> Optional[str]:
    """Load the default prompt template for a tool."""
    path = TOOLS_DIR / tool_id / "default_prompt.txt"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return None


def _get_brand_override(brand: dict, tool_id: str) -> Optional[str]:
    """Get a brand-specific prompt override for a tool, if one exists."""
    overrides = brand.get("promptOverrides", {})
    override = overrides.get(tool_id, "")
    return override.strip() if override and override.strip() else None


def resolve_template(tool_id: str, brand: dict) -> Optional[str]:
    """
    Resolve which template to use for a tool+brand combination.
    Priority: Brand Override > Tool Default
    Returns None if no template exists.
    """
    # Layer 2: Brand override (highest priority)
    override = _get_brand_override(brand, tool_id)
    if override:
        return override

    # Layer 1: Tool default
    return _load_default_template(tool_id)


# ── Prompt Assembly ─────────────────────────────────────────────

def _fill_template(template: str, variables: Dict[str, str]) -> str:
    """
    Fill template variables using {variable_name} syntax.

    Special handling:
    - {?section_name} ... {/section_name} → conditional blocks, only included if variable is non-empty
    - {variable_name} → simple replacement
    """
    # First: handle conditional blocks {?var} ... {/var}
    def replace_conditional(match):
        var_name = match.group(1)
        content = match.group(2)
        value = variables.get(var_name, "")
        if value:
            # Fill any variables inside the conditional block too
            return _fill_simple_vars(content.strip(), variables)
        return ""

    result = re.sub(
        r'\{\?(\w+)\}(.*?)\{/\1\}',
        replace_conditional,
        template,
        flags=re.DOTALL
    )

    # Then: simple variable replacement
    result = _fill_simple_vars(result, variables)

    # Clean up excessive blank lines (3+ → 2)
    result = re.sub(r'\n{3,}', '\n\n', result)

    return result.strip()


def _fill_simple_vars(text: str, variables: Dict[str, str]) -> str:
    """Replace {variable_name} with values from the variables dict."""
    def replacer(match):
        var_name = match.group(1)
        return variables.get(var_name, match.group(0))  # Keep original if not found

    return re.sub(r'\{(\w+)\}', replacer, text)


# ── Public API ──────────────────────────────────────────────────

def build_prompt(
    tool_id: str,
    brand: dict,
    extra_variables: Optional[Dict[str, str]] = None,
) -> Optional[str]:
    """
    Build a complete prompt for a tool+brand combination.

    1. Resolves the template (brand override or tool default)
    2. Builds context variables from brand data
    3. Fills the template with variables

    Returns None if no template exists for the tool.
    """
    template = resolve_template(tool_id, brand)
    if not template:
        return None

    variables = build_context_variables(brand, extra_variables)
    return _fill_template(template, variables)


def build_chat_system_prompt(brand: dict) -> str:
    """
    Build the system prompt for brand chat.
    Uses the 'chat' tool template if it exists, otherwise falls back
    to a programmatic default.
    """
    prompt = build_prompt("chat", brand)
    if prompt:
        return prompt

    # Fallback: programmatic assembly (legacy behavior)
    return _build_chat_fallback(brand)


def _build_chat_fallback(brand: dict) -> str:
    """Legacy chat prompt builder — used when no chat template exists."""
    name = brand.get("name", "Unknown")
    sections = []

    sections.append(
        f"You are a creative AI assistant for the brand **{name}**.\n"
        "You help with content creation, copywriting, campaign ideas, scripts, and any creative task.\n"
        "Always stay in character with the brand's tone and context.\n"
        "When the user references an asset (avatar, product, voice) by name, "
        "use the detailed information below to inform your response."
    )

    context = brand.get("brandContext", "").strip()
    if context:
        sections.append(f"BRAND CONTEXT:\n{context}")

    # Avatars with full descriptions
    avatars = brand.get("avatars", [])
    if avatars:
        lines = []
        for av in avatars:
            line = f"- **{av.get('name', 'Unnamed')}**"
            desc = av.get("description", "")
            if desc:
                line += f": {desc}"
            tags = av.get("tags", [])
            if tags:
                line += f" (tags: {', '.join(tags)})"
            lines.append(line)
        sections.append("AVAILABLE AVATARS (people/models for content):\n" + "\n".join(lines))

    # Products with descriptions
    products = brand.get("products", [])
    if products:
        lines = []
        for p in products:
            line = f"- **{p.get('name', 'Unnamed')}**"
            desc = p.get("description", "")
            if desc:
                line += f": {desc}"
            cat = p.get("category", "")
            if cat:
                line += f" [{cat}]"
            lines.append(line)
        sections.append("PRODUCTS:\n" + "\n".join(lines))

    # Voice presets
    voices = brand.get("voicePresets", [])
    if voices:
        lines = [f"- {v.get('name', v.get('id', 'Unknown'))}" for v in voices]
        sections.append("VOICE PRESETS (available TTS voices):\n" + "\n".join(lines))

    # Clothing
    clothing = brand.get("clothing", [])
    if clothing:
        lines = []
        for c in clothing:
            line = f"- {c.get('name', c.get('description', 'Item'))}"
            desc = c.get("description", "")
            if desc and desc != c.get("name", ""):
                line += f": {desc}"
            lines.append(line)
        sections.append("WARDROBE / CLOTHING:\n" + "\n".join(lines))

    # Backgrounds
    backgrounds = brand.get("backgrounds", [])
    if backgrounds:
        lines = []
        for bg in backgrounds:
            line = f"- **{bg.get('name', 'Unnamed')}**"
            desc = bg.get("description", "")
            if desc:
                line += f": {desc}"
            tags = bg.get("tags", [])
            if tags:
                line += f" (tags: {', '.join(tags)})"
            lines.append(line)
        sections.append("BACKGROUNDS / SCENES (available for content):\n" + "\n".join(lines))

    sections.append(
        "AVAILABLE TOOLS (the user can generate content with these):\n"
        "- UGC Creator: Generate UGC-style video scripts and content\n"
        "- Ad Creative: Generate advertising creatives\n"
        "- Social Post: Generate social media post content\n"
        "- Reel Creator: Create short-form video reels\n"
        "\nYou can suggest using these tools when relevant to the conversation."
    )

    sections.append("Respond in the same language the user writes in.")

    return "\n\n".join(sections)


def list_tool_templates() -> List[Dict[str, str]]:
    """List all tools that have default prompt templates."""
    templates = []
    if not TOOLS_DIR.exists():
        return templates

    for tool_dir in sorted(TOOLS_DIR.iterdir()):
        if not tool_dir.is_dir():
            continue
        prompt_file = tool_dir / "default_prompt.txt"
        if prompt_file.exists():
            templates.append({
                "tool_id": tool_dir.name,
                "path": str(prompt_file),
                "preview": prompt_file.read_text(encoding="utf-8").strip()[:200],
            })
    return templates


def get_brand_overrides(brand: dict) -> Dict[str, str]:
    """Get all prompt overrides for a brand."""
    return brand.get("promptOverrides", {})
