# Handoff: Zeitleiste (Buchnotizen-Timeline)

## Overview
An interactive historical timeline for book/reading notes. Plots people (as lifespan bars) and world events along a shared year axis, grouped by country, with filtering by category/country, cross-references between entries, and a detail panel.

## About the Design Files
The bundled file is a **design reference built in HTML** — a working prototype showing intended look, layout, and interaction, not production code to copy directly. The task is to **recreate this design in the target codebase's existing environment** (React, Vue, native, etc.) using its established component patterns, state management, and styling system. If no environment exists yet, choose the most appropriate framework and implement there.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interactions shown are final — recreate pixel-precisely using the target codebase's own component/styling primitives (don't just embed the HTML/CSS).

## Screens / Views
Single-page app, three vertical zones stacked (header, filter bar, main), no routing.

### 1. Header
- Height: auto, padding `16px 28px`, flex row, `gap:20px`, wraps on narrow widths.
- Background: `oklch(99% 0.003 75 / 0.85)` with `backdrop-filter: saturate(160%) blur(12px)`, bottom border `1px solid var(--line)`.
- Left: 36×36px logo tile (accent bg, serif "◷" glyph, white) + title block ("Zeitleiste" serif 19px/600, subtitle "Buchnotizen" 11px muted).
- Middle button group: "＋ Eintrag" (primary, accent bg), "🔗 Verknüpfen", "↔ Verbindungen" (toggle — active state = accent-soft bg/border), "▒ Schattierung" (toggle, same pattern).
- Right-aligned button group (`margin-left:auto`): "🎨 Kategorien", "📖 Quellen", "⤢ Einpassen", "?" (square icon button, opens help modal).
- All buttons: `font-size:13px`, `font-weight:600`, `padding:9px 15–16px`, `border-radius:1px` (near-square, not rounded), `box-shadow: var(--shadow-sm)`.

### 2. Filter bar
- Padding `12px 28px`, flex row, `gap:10px`, wraps.
- "KATEGORIEN" label (10px uppercase muted) + category chips (colored dot + name, toggle opacity 1↔0.4 on click).
- Vertical divider, "LÄNDER" label + country chips (same toggle pattern, no dot).
- Right-aligned counter text: "N sichtbar / M gesamt".

### 3. Main area
Flex row: scrollable timeline canvas (flex:1) + fixed detail panel (360px).

**Timeline canvas** (card with border/shadow, `overflow:auto` both axes):
- Inner layout is a flex row with two children that scroll together:
  - **Left rail** (150px, `position:sticky; left:0`, so it stays visible while scrolling horizontally; `border-right:1px solid var(--line)`; background matches surface so it never sits *under* the timeline content):
    - Top spacer matching the axis height (44px) with matching bottom border.
    - Vertical (rotated 180°, `writing-mode:vertical-rl`) label "◆ Ereignisse" aligned to the world-events row (top 16px, height 40px).
    - 1px horizontal divider line beneath it — the explicit **Ereignisse / Personen separator**.
    - Vertical label "● Personen" spanning the remaining height below the divider.
    - Country-group name labels (10px uppercase muted) positioned to line up with each country's row block, each preceded by a 1px divider line (except the first group).
  - **Timeline content** (`min-width:2620px`, horizontally scrollable together with the rail's sticky context):
    - **Axis row** (44px): year gridlines every 25 years from 1700–2000, tick label above each line.
    - **Track** (512px tall, `margin-top:16px`):
      - Shading bands: translucent background rectangles behind each world-event's date range (toggleable via "▒ Schattierung").
      - World-event chips: single row near the top (16–56px), rounded-square pill, click → selects in detail panel.
      - Person rows: for each person — a "frame" rect spanning birth–death years (soft category color fill/border), a "life bar" label (name · years) inside it, and sub-event chips positioned by year within the person's row. Rows are grouped by country (sorted alphabetically, then by birth year), with 24px gaps between country groups.
    - A connections/arrows layer exists (SVG, toggled via "↔ Verbindungen") — currently empty/disabled in the reference; wire it up per the "State Management" section below if the target implementation needs it.

**Detail panel** (aside, 360px, left border, padding 24px):
- Empty state: centered clock glyph + "Klicke einen Eintrag an, um Details zu sehen."
- Filled state (person / event / world-event): colored accent bar + serif title (20px/600) + subtitle line, then labeled sections (10px uppercase muted labels): "Zeit", optional "Notiz" (description), optional "Quelle" (source name/meta + italic blockquote quote with accent left-border), optional "Ereignisse" list (sub-events, clickable), optional "Verbindungen" list (related entries, clickable). Footer actions: "✎ Bearbeiten", "🔗 Verknüpfen".

### Modals (centered overlay, `oklch(20% 0.02 265 / 0.42)` backdrop + blur)
- **Add-entry modal**: type toggle (◆ Ereignis / 👤 Person), Titel input, Land input, Abbrechen/Speichern buttons.
- **Help modal**: bullet list of usage tips, Schließen button.

## Interactions & Behavior
- Click a category or country chip → toggles it off (dims to 0.4 opacity) without removing other filters; dimmed persons also drop opacity in the track.
- Click "↔ Verbindungen" / "▒ Schattierung" → toggles that layer's visibility; button switches to an active (accent-soft) visual state.
- Click any world-event chip, person life-bar, or sub-event chip → sets it as the selected item and populates the detail panel.
- Detail panel's "Ereignisse"/"Verbindungen" list items are clickable and re-select that related entry (cross-navigation).
- "＋ Eintrag" opens the add-entry modal; "?" opens the help modal. Both close on backdrop click, X/Abbrechen/Schließen, or (implied) Escape.
- No persisted state/animations beyond simple show/hide; all transitions are instant.

## State Management
Suggested state shape (mirrors the prototype's logic class):
- `selectedId: string | null` — currently selected item (person, event, or world-event) driving the detail panel.
- `offCats: Set<string>` — category ids toggled off.
- `offCountries: Set<string>` — country names toggled off.
- `connectionsOn: boolean`, `shadingOn: boolean` — layer toggles.
- `modalOpen: boolean`, `helpOpen: boolean`.
- Derived: filtered/dimmed rows, country groupings (sort by country then birth year), axis tick list, and the detail-panel content object (varies by item kind: person / event / world-event, each with different available sections as described above).

## Design Tokens

### Colors (as CSS custom properties in the prototype; base theme "Bronze & Papier")
- `--surface: oklch(99% 0.003 75)` / `--surface-2: oklch(95.3% 0.009 75)`
- `--line: oklch(89% 0.012 75)` (borders/dividers)
- `--ink: oklch(27% 0.015 265)` / `--ink-soft: oklch(42% 0.015 265)` / `--muted: oklch(58% 0.012 265)`
- `--bg: oklch(97.3% 0.006 75)`
- `--accent: oklch(46% 0.1 55)` / `--accent-soft: oklch(93% 0.035 55)` / `--accent-ink: oklch(38% 0.1 55)`
- Category colors: Naturforschung `oklch(56% 0.09 150)` (soft `oklch(93% 0.03 150)`); Wissenschaft `oklch(56% 0.1 210)` (soft `oklch(93% 0.03 210)`); Politik `oklch(54% 0.1 320)` (soft `oklch(93% 0.03 320)`).
- The component exposes 4 alternate theme presets (swap accent + bg together): Tiefes Petrol, Bordeaux, Waldgrün, Anthrazit & Gold — see `THEMES` in the script block of the file for exact values.
- Shadows: `--shadow-sm: 0 1px 2px oklch(20% 0.02 265/0.06), 0 1px 3px oklch(20% 0.02 265/0.05)`; `--shadow: 0 14px 34px oklch(20% 0.02 265/0.10), 0 2px 8px oklch(20% 0.02 265/0.06)`.

### Typography
- Serif (headings/titles): "Source Serif 4", weights 400/500/600, italic 500 available.
- Sans (everything else): "Manrope", weights 400/500/600/700/800.
- Scale used: 11px (subtitles/meta), 10px (uppercase eyebrow labels, `letter-spacing:.06–.08em`), 12.5–13.5px (body/buttons/chips), 19–20px (modal/detail headings), 18px (logo glyph).

### Spacing / Layout
- Header padding `16px 28px`; filter bar `12px 28px`; detail panel padding `24px`; canvas padding `20px`.
- Border radius is intentionally near-flat: `--radius / --radius-sm: 1px` everywhere (buttons, cards, chips) — not a rounded-corner system.
- Row height per person: 88px; gap between country groups: 24px; axis height: 44px; world-events row: top 16px, height 40px.
- Timeline scale: 9px per year, starting at year 1700.
- Left rail width: 150px. Detail panel width: 360px (fixed).

## Assets
No external images/icons — all glyphs are unicode/emoji characters (◷ ◆ ● ✎ 🔗 ↔ ▒ 🎨 📖 ⤢ ＋ 👤). No SVG icon set or illustration assets are used.

## Files
- `Zeitleiste Redesign.dc.html` — the full design reference (markup + inline logic/data). Open directly in a browser to view/interact with it.
