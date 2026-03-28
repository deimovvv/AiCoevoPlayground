# Morph — Design System

The platform uses a dark, editorial design language centered on precision and density.

The UI prioritizes clarity and workflow speed, with a sophisticated neutral palette accented by warm burgundy tones.

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

| Token           | Value    | Usage                        |
|-----------------|----------|------------------------------|
| `--color-canvas`    | `#000000` | Main content background (pure black) |
| `--color-surface-0` | `#141414` | Sidebar, elevated containers |
| `--color-surface-1` | `#1c1c1c` | Cards, secondary panels      |
| `--color-surface-2` | `#242424` | Hover states, active items   |
| `--color-surface-3` | `#2c2c2c` | Inputs, tertiary elements    |

### Foreground (Pure Neutral)

| Token              | Value    | Usage                    |
|--------------------|----------|--------------------------|
| `--color-fg`           | `#eeeeee` | Primary text             |
| `--color-fg-secondary` | `#aaaaaa` | Secondary text           |
| `--color-fg-muted`     | `#777777` | Muted/helper text        |
| `--color-fg-faint`     | `#555555` | Disabled/placeholder     |

### Borders

| Token              | Value                      |
|--------------------|----------------------------|
| `--color-edge`         | `rgba(255,255,255,0.10)` |
| `--color-edge-subtle`  | `rgba(255,255,255,0.06)` |
| `--color-edge-strong`  | `rgba(255,255,255,0.18)` |
| `--color-edge-focus`   | `rgba(200,200,200,0.35)` |

### Brand Accent (Warm)

| Token               | Value                      | Usage                    |
|----------------------|----------------------------|--------------------------|
| `--color-warm`           | `#c45830`                | Bordeaux/terracotta signature |
| `--color-warm-muted`     | `rgba(196,88,48,0.12)`   | Background tints         |
| `--color-warm-subtle`    | `rgba(196,88,48,0.06)`   | Ambient glow             |

### Semantic Colors

| Token              | Value    |
|--------------------|----------|
| `--color-success`      | `#3DBF8A` |
| `--color-warning`      | `#E4AB1B` |
| `--color-error`        | `#E96565` |

---

## Typography

- **Primary Font**: Inter (via Google Fonts)
- **Sizes**: 11px (captions), 12px (small), 13px (body), 14px (labels), 22px (page titles)
- **Weights**: 400 (body), 500 (medium), 600 (semibold), 700 (bold)

---

## Layout

- **Sidebar**: Fixed left, 200px width, `surface-0` background
- **Content area**: `canvas` (pure black) background
- **Max content width**: ~1200px
- **Spacing scale**: 4px base grid (8, 12, 16, 24, 32)
- **Border radius**: `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg` (12px)

---

## Key Components

### Sidebar Navigation

- Morph logo with warm burgundy diamond icon
- Menu items: Dashboard, Brands, Tools (collapsible dropdown), Settings
- Active state: `surface-2` background with `fg` text
- Hover: `surface-1` background

### Dashboard Overview

- Stat cards (Brands count, Active Tools, Total Avatars)
- Brands preview section (up to 3 brands)
- Image Tools / Video Tools summary sections
- Subtle ambient warm glow (radial gradient)

### Brand Cards

- Dark `surface-0` background with edge border
- Brand icon in warm-tinted container
- Avatar/voice count indicators
- Hover: border-edge-strong, slight elevation

### Tool Cards

- Grid layout, category-filtered by route
- Status badges: active (chevron arrow) / coming_soon (pill)
- Click opens dynamic configuration modal

### Buttons

- Default: `surface-2` background, `edge-strong` border, neutral text
- Ghost: transparent, hover `surface-1`
- No blue accents anywhere

---

## UX Flow

1. User opens platform → Home page (dark, warm glow, CTA)
2. Enters Dashboard → Overview with stats
3. Navigates to **Brands** → Full brand list, add/manage brands
4. Enters **Brand Workspace** → Scripts, avatars, voices, Brand DNA
5. Runs **Generation Pipeline** → Multi-segment TTS + lip-sync
6. Uses **Tools** → Image/Video AI tools with dynamic configs

---

## Mobile Support

Optimized for desktop use. Mobile support is not a priority.