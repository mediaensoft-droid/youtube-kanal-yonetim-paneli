---
name: Kanal Paneli
description: Çok kanallı YouTube portföy yönetim paneli
colors:
  brand-red: "#ff0000"
  brand-red-hover: "#e60000"
  brand-red-soft: "rgba(255, 0, 0, 0.12)"
  canvas: "#0f0f0f"
  surface: "#181818"
  surface-2: "#212121"
  surface-hover: "#272727"
  line: "#303030"
  line-strong: "#3f3f3f"
  ink: "#f1f1f1"
  ink-muted: "#aaaaaa"
  ink-faint: "#717171"
  chart-teal: "#2dd4bf"
  chart-teal-deep: "#114a45"
  chart-blue: "#4da3ff"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: "1.15"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "1.3"
  heading:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "1.4"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "1.4"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.brand-red}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.brand-red-hover}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  badge:
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Kanal Paneli

## Overview

**Creative North Star: "Kırmızı Kontrol Odası" (The Red Control Room)**

Kanal Paneli is a near-black operations panel for running a portfolio of YouTube channels: every screen is dense with real, live data — subscriber counts, publish calendars, category and language breakdowns — laid out on a nearly monochrome dark surface where YouTube red is the single, deliberately rare accent. The system reads as calm and functional first: flat surfaces at rest, quiet borders instead of heavy chrome, and text that stays legible at a glance across long lists of channels. Motion and color exist to draw the eye to what matters (a live status, an active nav item, a hover target) rather than to decorate. There is no invented "editorial" or "playful" layer here — the aesthetic is a straightforward, red-accented dark admin console, and that restraint is the point.

The one deliberately expressive layer is the animated background: a fixed field of translucent YouTube-iconography (play buttons, thumbs-up, bells) drifting slowly behind every page, plus small floating outline shapes and a slow rotating glow behind Dashboard cards. This is confined to decoration — it never sits behind readable text or interactive controls, and it always respects `prefers-reduced-motion`.

**Key Characteristics:**
- Near-black canvas with a single, sparing red accent — everything else is neutral gray/white text on gray surfaces.
- Flat by default; elevation only appears as a response to hover or as a fixed hierarchy for overlays (dropdown → modal).
- Every interactive surface (button, input, card, nav item) shares the same 150–200ms color/shadow transition and the same border-radius family.
- A confirmed dark-only theme: no light mode exists or is implied anywhere in the tokens.
- Real product data (channel names, thumbnails, flags, stats) is trusted to carry visual interest; the chrome around it stays quiet.

## Colors

The palette is almost entirely neutral grays (a five-step surface/text ladder) plus one saturated accent; a small set of chart-only teal/blue tones exists strictly for data visualization, never for chrome.

### Primary
- **Brand Red** (`#ff0000`): the single accent — active nav pill, primary buttons, focus rings, links-as-brand, "live" badges. Used sparingly; most of any screen carries none of it.
- **Brand Red Hover** (`#e60000`): primary-button and brand-link hover/active state. Slightly darker, never lighter.
- **Brand Red Soft** (`rgba(255, 0, 0, 0.12)`): a translucent red tint for icon-circle backgrounds and the pulse-ring animation behind Dashboard stat icons — reads as "brand-tinted glass," not a solid fill.

### Secondary (chart-only)
- **Chart Blue** (`#4da3ff`): the language-distribution bar chart's bar color. Not used outside charts.

### Tertiary (chart-only)
- **Chart Teal** (`#2dd4bf`) / **Chart Teal Deep** (`#114a45`): the country map's high/low intensity gradient endpoints, mixed by value. Not used outside the map and its legend.

### Neutral
- **Canvas** (`#0f0f0f`): the page background, near-black.
- **Surface** (`#181818`): card, panel, and nav backgrounds — one step lighter than canvas.
- **Surface 2** (`#212121`): nested surfaces — input/select/textarea backgrounds, secondary chips, table-row tint.
- **Surface Hover** (`#272727`): hover background for ghost buttons, list rows, menu items.
- **Line** (`#303030`): default border — card edges, dividers, table cell borders.
- **Line Strong** (`#3f3f3f`): emphasized border — hover state of a bordered card/button, focused non-input containers.
- **Ink** (`#f1f1f1`): primary text.
- **Ink Muted** (`#aaaaaa`): secondary text — labels, meta rows, unselected nav items.
- **Ink Faint** (`#717171`): tertiary text — placeholders, disabled text, faint icons, day-of-month numbers outside the current month.

### Named Rules
**The One Accent Rule.** Brand red is the only saturated color allowed in chrome (nav, buttons, borders, focus). Category/concept badge colors are the sole deliberate exception — those are user-assigned per category and drawn from a rotating palette generator, not from this token set.

**The Status-Color Exception.** The publish calendar borrows Tailwind's stock `emerald` (published) and `amber` (skipped) families for status dots/chips — these are semantic status colors, not part of the brand palette, and should never be reused for anything that isn't a schedule status.

## Typography

**Body Font:** Archivo (via `next/font/google`, `--font-archivo`), system-ui fallback.

**Character:** A grotesk with a slightly engineered, technical edge — legible and workhorse-plain at the dense 12–14px UI sizes the Operate surfaces live at, with enough structure to hold its own at Display size on the one Persuade surface (`/sign-in`). One family throughout; hierarchy is carried by size and weight, not by font change.

### Hierarchy
- **Display** (700, 30–48px fluid, 1.15): the single Persuade-surface hero headline (`/sign-in`). Bigger and bolder than every Operate-mode title on purpose — this is the one screen whose job is to be read from across the room, not scanned in a list. Never used inside the authenticated app.
- **Title** (600, 24px, 1.3): page-level `<h1>` (e.g. "Dashboard", "Yayın Takvimi").
- **Heading** (600, 16px, 1.4): card/section headers, usually paired with a small lucide-react icon (`h-4 w-4`) at `text-ink-muted`.
- **Body** (400, 14px, 1.5): the default UI text size — table cells, form values, most labels and buttons.
- **Label** (500, 12px, 1.4): meta text, badge text, chart axis labels, timestamps.

### Named Rules
**The One-Family Rule.** Archivo is loaded once in `layout.tsx` and consumed through `body`'s `font-family: var(--font-sans)` — every weight and size step in this system is the same family. Don't introduce a second typeface for "display" contrast; the Display role gets there through size/weight alone.

## Layout

Single-column content area capped at `max-w-6xl`, centered, with `px-4 py-8` page padding (`layout.tsx`'s `<main>`). Dashboard and list pages use CSS grid, mobile-first: one column by default, opening to more columns at `sm`/`lg`/`xl`. Card-grid density is explicit at two named modes ("Büyük"/large, "Küçük"/small) rather than one automatic breakpoint ladder, each with its own per-breakpoint column count so the two remain visually distinct on every screen size including mobile. Tables and the month calendar grid switch to a stacked/agenda layout below `sm` instead of shrinking columns, since a fixed multi-column grid becomes unreadable on a phone. Section spacing runs on a `gap-4` (16px) rhythm; card internal padding is `p-5` (20px).

## Elevation & Depth

Flat at rest, tonal-plus-shadow on interaction — a four-step ladder tied to how far a surface sits above the page, not to component type:

1. **Resting card/tile**: `shadow-sm` — barely-there separation from canvas.
2. **Hover-elevated card/tile**: `shadow-lg shadow-black/20` (or `shadow-xl shadow-black/30` for image-heavy cards like `ChannelCard`), paired with a `-translate-y-0.5` lift and a border shift from `line` to `line-strong`.
3. **Popovers, tooltips, context menus, dropdown panels**: `shadow-xl shadow-black/40` — floats clearly above page content.
4. **Modals/dialogs**: `shadow-2xl shadow-black/50` — the deepest level, always paired with a `bg-black/70 backdrop-blur-sm` scrim.

An active nav item skips shadow entirely and uses a 1px colored ring instead (`shadow-[0_0_0_1px_rgba(255,0,0,0.35)]`) — selection state, not elevation.

### Named Rules
**The Elevate-on-Hover Rule.** Nothing casts a shadow just for existing; shadow strength only increases in direct response to hover or stacking context (popover/modal), and always resets on mouse-leave.

## Shapes

Three border-radius steps, chosen by role rather than component size:
- **`rounded-md` (6px)**: every interactive control — buttons, inputs, selects, textareas, small day-toggle chips, icon buttons.
- **`rounded-lg` (8px)**: containers — cards, panels, modals, dropdown menus, the calendar grid's outer frame.
- **`rounded-full`**: anything circular or pill-shaped — avatars, channel thumbnails, category/concept badges, status dots, the floating nav avatar.

Borders are always 1px, solid, `line` at rest and `line-strong` on hover/focus — no dashed, double, or gradient borders anywhere in the system.

## Components

### Buttons
- **Shape:** `rounded-md` (6px), `px-4 py-2` for default size, `px-2.5 py-1.5` for `sm`.
- **Primary:** `bg-brand` (`#ff0000`) / white text; hover → `bg-brand-hover` (`#e60000`); disabled → `bg-line-strong` / `text-ink-faint`.
- **Secondary:** `bg-surface-2` / `text-ink`, `border border-line`; hover → `bg-surface-hover`, `border-line-strong`.
- **Danger:** transparent background, `text-red-400`, `border border-red-900/60`; hover → `bg-red-950/40`.
- **Ghost:** transparent, `text-ink-muted`; hover → `bg-surface-hover`, `text-ink`.
- **Interaction:** every variant does `active:scale-[0.97]` on press — the one shared tactile cue across all buttons.

### Chips / Badges
- **Category/concept badge** (`CategoryBadge`): `rounded-full`, `px-2.5 py-0.5`, `text-xs font-medium`; background is the category's own stored hex, text color auto-computed for contrast (`contrastTextColor`). Never a fixed brand color.
- **Status chip** (calendar): `rounded` border chip with a leading 2px dot (`bg-emerald-400`/`bg-amber-400`/`bg-ink-faint`) plus a tinted background/border/text triplet per status.
- **Day-toggle chip**: `rounded-md`, active → `border-brand bg-brand text-white`; inactive → `border-line bg-surface text-ink-muted`.

### Cards / Containers
- **Corner Style:** `rounded-lg` (8px).
- **Background:** `bg-surface` (`#181818`), occasionally `bg-surface-2` for nested/secondary cards (e.g. the "Kanal Yayın Günleri" panel's per-channel row).
- **Border:** always `border border-line`, shifting to `border-line-strong` on hover.
- **Shadow Strategy:** see Elevation & Depth's four-step ladder.
- **Internal Padding:** `p-5` (20px) standard, `p-3`–`p-4` for denser nested rows.

### Inputs / Fields
- **Style:** `border border-line`, `bg-surface-2`, `rounded-md`, `px-3 py-2`, `text-sm`.
- **Focus:** `border-brand` + `ring-1 ring-brand` — no glow/blur, a crisp 1px ring plus border color change.
- **Placeholder:** `text-ink-faint`.

### Navigation
- Desktop: a horizontal pill row; active item is `bg-brand text-white` with the colored-ring shadow; inactive is `text-ink-muted`, hover → `bg-surface-hover text-ink`.
- Mobile: a hamburger-triggered dropdown panel below the bar reusing the same active/inactive treatment as full-width rows.
- The user avatar (Google photo, or an app-uploaded replacement, or an initial-letter circle fallback) sits after the nav links and links to `/profile`.

### Dashboard Card Motion (signature component)
Every Dashboard card (stat tiles and the four chart cards) carries three coordinated motion layers, all gated behind `prefers-reduced-motion`: a `card-glow`/`CardShapes` field of slowly drifting translucent circles/rings/dots/diamonds behind the content (`relative overflow-hidden` on the card, `relative z-10` on the real content so it paints above the shapes); a `breathe` micro-pulse on the card's header icon; and, on stat tiles specifically, a `pulse-ring` radar-style ping behind the icon circle plus a count-up animation on the numeric value. This is the one place in the system where decoration is layered rather than purely reactive — reserved for the Dashboard, not general chrome.

## Do's and Don'ts

### Do:
- **Do** keep brand red rare — reach for it only for the primary action, active/selected state, or a genuine "live/attention" signal.
- **Do** use the four-step shadow ladder (`shadow-sm` → hover `shadow-lg/xl` → popover `shadow-xl/40` → modal `shadow-2xl/50`) instead of picking a shadow by feel.
- **Do** pair every hover shadow increase with a border shift (`line` → `line-strong`), not shadow alone.
- **Do** gate every non-essential looping animation behind `prefers-reduced-motion: reduce` (every existing keyframe class already does this — keep new ones consistent).
- **Do** give a card-grid or table its own stacked/agenda layout below `sm` rather than letting a fixed column count get crushed on mobile.

### Don't:
- **Don't** introduce a second accent color into chrome — category/concept badges and chart colors are the only exceptions, and they're intentionally scoped to their own contexts.
- **Don't** add a shadow to a resting, non-interactive element — flat-by-default is a rule, not a placeholder.
- **Don't** load a second typeface for contrast — Archivo's weight range (400–700 used today) carries the whole hierarchy, Display included.
- **Don't** use dashed, double, or gradient borders — every border in the system is 1px solid `line`/`line-strong`.
- **Don't** build a light theme variant without an explicit decision — every token here assumes a permanently dark canvas.
