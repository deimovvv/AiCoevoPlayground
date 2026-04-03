# Coevo Creative OS — Design System

The platform uses a dark, editorial design language centered on precision and density. The UI prioritizes clarity and workflow speed, with a sophisticated neutral palette accented by warm burgundy tones.

---

## Design Principles

- **Clarity first** — Operators understand the system in seconds
- **Minimal UI** — Avoid unnecessary complexity
- **Content focused** — Scripts, assets, and videos are the visual focus
- **Dark editorial** — Pure blacks and neutral grays, zero blue
- **Warm signature** — Burgundy/terracotta accent (#c45830) for brand identity

---

## Color System

### Surfaces (Dark Mode)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-canvas` | `#000000` | Main content background (pure black) |
| `--color-surface-0` | `#141414` | Sidebar, elevated containers |
| `--color-surface-1` | `#1c1c1c` | Cards, secondary panels |
| `--color-surface-2` | `#242424` | Hover states, active items |
| `--color-surface-3` | `#2c2c2c` | Inputs, tertiary elements |

### Foreground (Pure Neutral)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-fg` | `#eeeeee` | Primary text |
| `--color-fg-secondary` | `#aaaaaa` | Secondary text |
| `--color-fg-muted` | `#777777` | Muted/helper text |
| `--color-fg-faint` | `#555555` | Disabled/placeholder |

### Borders

| Token | Value |
|-------|-------|
| `--color-edge` | `rgba(255,255,255,0.10)` |
| `--color-edge-subtle` | `rgba(255,255,255,0.06)` |
| `--color-edge-strong` | `rgba(255,255,255,0.18)` |
| `--color-edge-focus` | `rgba(200,200,200,0.35)` |

### Brand Accent (Warm)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-warm` | `#c45830` | Burgundy/terracotta signature |
| `--color-warm-muted` | `rgba(196,88,48,0.12)` | Background tints |
| `--color-warm-subtle` | `rgba(196,88,48,0.06)` | Ambient glow |

### Semantic Colors

| Token | Value |
|-------|-------|
| `--color-success` | `#3DBF8A` |
| `--color-warning` | `#E4AB1B` |
| `--color-error` | `#E96565` |

---

## Typography

- **Primary Font**: Inter (via Google Fonts)
- **Sizes**: 11px (captions), 12px (small), 13px (body), 14px (labels), 16px (section titles), 20px (page titles)
- **Weights**: 400 (body), 500 (medium), 600 (semibold), 700 (bold)

---

## Layout

- **Sidebar**: Fixed left, 200px width, `surface-0` background
- **Content area**: `canvas` (pure black) background
- **Max content width**: ~1200px (3xl for chat)
- **Spacing scale**: 4px base grid (4, 8, 12, 16, 24, 32)
- **Border radius**: `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg` (12px)

---

## Key Components

### Sidebar Navigation
- Brand switcher dropdown at top
- Collapsible sections: Chat, Generate, Content | Brand, Settings, Integrations | Performance
- Active state: `surface-2` background with `fg` text
- Hover: `surface-1` background

### Brand Cards (Dashboard)
- Dark `surface-0` background with edge border
- Brand icon in warm-tinted container
- Avatar/voice count indicators
- Hover: border-edge-strong, arrow animation

### Tool Cards (Generate Page)
- Grid layout, category-filtered (images/video/copy)
- Status badges: active (chevron arrow) / coming_soon (pill)
- Pipeline step indicators

### Chat Panel (Workspace)
- Full-height with message area + input
- Asset chip groups (collapsible, max 3 visible)
- Tool quick action buttons
- Chat history sidebar (right)

### Pipeline Steps (ToolRunPage)
- Vertical step-by-step progression
- States: idle, running (spinner), done (green check), error (red)
- Rich results per step type (images, audio waveforms, video players)

### Buttons
- Default: `surface-2` background, `edge-strong` border, neutral text
- Ghost: transparent, hover `surface-1`
- Accent: warm background for primary actions
- No blue accents anywhere

---

## UX Flow

1. User opens platform -> Home page (dark, warm glow, CTA)
2. Enters Dashboard -> Brand list with cards
3. Selects brand via card or switcher -> Workspace with AI chat
4. Uses chat for quick creative tasks or navigates to Generate
5. Generate -> Tool selection -> Step-by-step pipeline execution
6. Results appear inline, downloadable

---

## Mobile Support

Optimized for desktop use. Mobile support is not a priority for Phase 1.
