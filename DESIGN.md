---
name: Ticqex
description: Agent-first support control surface — calm, dense, infrastructure-grade admin UI
colors:
  canvas: "oklch(1 0 0)"
  ink: "oklch(0.147 0.004 49.25)"
  ink-soft: "oklch(0.216 0.006 56.043)"
  ink-on-dark: "oklch(0.985 0.001 106.423)"
  wash: "oklch(0.97 0.001 106.424)"
  wash-deep: "oklch(0.985 0.001 106.423)"
  text-muted: "oklch(0.553 0.013 58.071)"
  edge: "oklch(0.923 0.003 48.717)"
  focus-ring: "oklch(0.709 0.01 56.259)"
  signal: "oklch(0.577 0.245 27.325)"
typography:
  display:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  headline:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "normal"
  title:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "Source Sans 3, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Source Sans 3, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "calc(0.45rem * 0.6)"
  md: "calc(0.45rem * 0.8)"
  lg: "0.45rem"
  xl: "calc(0.45rem * 1.4)"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  control-h: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.ink-on-dark}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "{spacing.control-h}"
  button-primary-hover:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.ink-on-dark}"
    rounded: "{rounded.lg}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "{spacing.control-h}"
  button-ghost-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "{spacing.control-h}"
  card-default:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
  badge-default:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.ink-on-dark}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
---

# Design System: Ticqex

## 1. Overview

**Creative North Star: "The Control Room"**

Ticqex is a solo operator's desk for supervising agent-driven support. The visual system is technical, direct, and quiet: a monochrome control surface where ticket state, actor, and channel read faster than decoration. Density is a feature, not clutter; every pixel earns its place on the Kanban board or in settings.

The palette is deliberately restrained. Ink-on-canvas neutrals carry the UI; color appears where it carries meaning (status dots, tags, destructive signals, unread counts). Surfaces stay flat at rest and lift on interaction: rings and muted washes define structure, shadows appear only when something is grabbed, focused, or floating above the board.

This system explicitly rejects generic SaaS helpdesk clones, AI-slop scaffolding, and consumer/playful UI. No purple gradients, no cream body backgrounds, no gradient text, no mascot energy, no marketing filler inside admin surfaces.

**Key Characteristics:**

- Monochrome-first with semantic color only (status, tags, errors, unread)
- Compact controls (32px height) with tactile press feedback
- Instrument Sans for headings, Source Sans 3 for body, Geist Mono for code
- Flat tonal layering at rest; responsive lift on drag, FAB, and overlay states
- Ring borders (`ring-foreground/10`) over heavy box shadows for card depth
- Agent and human activity legible on cards before opening a ticket

## 2. Colors

A warm-neutral ink palette on pure canvas. Primary is ink, not brand purple; accents are earned by data, not decoration.

### Primary

- **Ink Charcoal** (oklch(0.216 0.006 56.043)): Primary actions, default badges, active nav ghost fill, avatar initials tint. The authoritative control color; dark enough to read as deliberate, not colorful.
- **Deep Ink** (oklch(0.147 0.004 49.25)): Body text, headings, card titles. Never washed out; must meet WCAG AA on canvas and wash surfaces.

### Secondary

- **Soft Wash** (oklch(0.97 0.001 106.424)): Secondary buttons, muted fills, lane column backgrounds at 50% opacity, hover states on ghost controls.
- **Mid Gray** (oklch(0.553 0.013 58.071)): Secondary text, previews, placeholders, metadata on ticket cards. Bumped toward ink when contrast is borderline.

### Tertiary

- **Signal Red** (oklch(0.577 0.245 27.325)): Destructive actions, warning badges, unread count pills. Used sparingly; never as a brand accent wash.
- **Status Spectrum** (per-lane `status.color` from settings): The only place saturated hue freely appears. Status dots, lane headers, filter chips. Never applied as page-wide gradients.

### Neutral

- **Pure Canvas** (oklch(1 0 0)): Page background, card faces, popover surfaces in light mode.
- **Panel Wash** (oklch(0.985 0.001 106.423)): Header bar, sidebar tokens, elevated panel backgrounds.
- **Hairline Edge** (oklch(0.923 0.003 48.717)): Borders on inputs, cards, lane dividers, header rule.
- **Focus Ring** (oklch(0.709 0.01 56.259)): Focus-visible rings at 50% opacity, 3px spread. Consistent across buttons, inputs, toggles.

### Named Rules

**The Earned Color Rule.** Saturated color appears only when it encodes state: lane status, tag, error, unread, or user-assigned status dot. Never as hero background, gradient text, or decorative stripe.

**The No-Cream Rule.** Body backgrounds stay at chroma 0 (pure canvas) or cool-tinted wash. Warm cream, sand, and parchment tints are prohibited.

## 3. Typography

**Display Font:** Instrument Sans (ui-sans-serif fallback)
**Body Font:** Source Sans 3 (ui-sans-serif fallback)
**Label/Mono Font:** Geist Mono (ui-monospace fallback)

**Character:** Heading face is geometric and slightly technical; body face is humanist and readable at small sizes. Together they signal infrastructure product, not consumer app. Weight contrast does the hierarchy work; size steps stay tight.

### Hierarchy

- **Display** (600, 1.125rem / 18px, 1.25): App wordmark, settings page title. `font-heading`, never above 1.25rem in admin surfaces.
- **Headline** (500, 1rem / 16px, 1.375): Card titles in modals, settings section headings.
- **Title** (500, 0.875rem / 14px, 1): Ticket card titles, lane column headers. Primary scannable label on the board.
- **Body** (400, 0.875rem / 14px, 1.5): Form labels, descriptions, settings copy. Cap line length at 65–75ch in prose blocks.
- **Label** (500, 0.75rem / 12px, 1.25): Badges, chip text, filter counts, metadata. Ticket card badges may drop to 10px for density; never below.
- **Mono** (400, 0.75rem / 12px, 1.5): API keys, MCP snippets, code blocks in settings.

### Named Rules

**The Two-Voice Rule.** Instrument Sans owns headings and navigation labels only. Source Sans 3 owns everything else. Geist Mono is reserved for machine-readable strings.

**The No-Subtitle Reflex Rule.** Page titles stand alone. Do not add a muted paragraph under every `h1` or `h2` that restates the heading. Descriptions appear only when they teach a non-obvious constraint.

## 4. Elevation

Flat tonal layering at rest; responsive lift when the user manipulates or focuses floating UI. Depth is communicated through background steps (canvas → wash → muted/50), hairline borders, and inset rings before shadows enter.

Lane columns sit on `bg-muted/50` with an inset `ring-foreground/5`. Cards use `ring-1 ring-foreground/10` on canvas, not drop shadows. The header is a single `border-b` on `bg-card`, not a floating chrome bar.

Shadows are state-driven, not decorative. Drag overlays and the mobile FAB use `shadow-lg`. Dragging list items in settings use `shadow-md`. Email draft panels use `shadow-sm`. If a surface is not being moved, focused as a floating layer, or acting as a FAB, it has no shadow.

### Shadow Vocabulary

- **Lift — drag/overlay** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): Kanban card drag overlay, mobile create FAB.
- **Lift — reorder** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): Settings drag handles while sorting.
- **Float — panel** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): Nested panels (email drafts) above board content.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat and ring-bordered at rest. Shadows appear only as a response to drag, overlay, or floating panel state.

**The No-Glass Rule.** Backdrop blur and glassmorphism are prohibited unless solving a specific legibility problem over busy content. Default modals and sheets use solid `bg-card` or `bg-background`.

## 5. Components

Tactile and confident: controls are compact but respond clearly to press, focus, and drag. Interactive feedback is immediate (opacity, translate-y, ring), never bouncy.

### Buttons

- **Shape:** Gently rounded (0.45rem / 7.2px `rounded-lg`), 32px default height.
- **Primary:** Ink Charcoal fill, ink-on-dark text, 10px horizontal padding. `font-medium text-sm`.
- **Hover / Focus / Active:** Primary hovers to 80% opacity. Focus-visible shows 3px ring at `ring/50`. Active state translates 1px down (`translate-y-px`) for tactile press.
- **Ghost:** Transparent default; wash fill on hover. Used for header nav and icon actions.
- **Outline:** Canvas fill, hairline edge border; muted wash on hover. Settings secondary actions.
- **Destructive:** Signal red at 10% background, full red text; never solid red buttons except unread badge edge cases.

### Chips

- **Style:** Pill badges (`rounded-4xl`), 20px height, 8px horizontal padding. Default uses ink-soft fill; secondary uses wash; outline uses hairline edge.
- **State:** Ticket card chips at 10px type for density. Filter active state uses primary fill with count numeral. Status color dots are 8px circles with `ring-1 ring-border`, separate from badge system.

### Cards / Containers

- **Corner Style:** 0.63rem / ~10px (`rounded-xl`).
- **Background:** Pure canvas face.
- **Shadow Strategy:** Ring only at rest (`ring-1 ring-foreground/10`). Shadow on drag overlay parent, not the card itself.
- **Border:** Ring preferred over `border` except footer dividers (`border-t` on muted/50 footer).
- **Internal Padding:** 12px vertical / 12px horizontal for `size="sm"` ticket cards; 16px default for modal and login cards.

### Inputs / Fields

- **Style:** 32px height, hairline edge border, transparent background (light), `rounded-lg`.
- **Focus:** Border shifts to focus-ring color; 3px ring at 50% opacity.
- **Placeholder:** Mid Gray; must meet 4.5:1 against canvas — bump toward ink if audit fails.
- **Error / Disabled:** Destructive border + ring on invalid; 50% opacity and `bg-input/50` when disabled.

### Navigation

- **Style:** Fixed top header, 56px height (`h-14`), canvas/card background, bottom border only.
- **Typography:** Wordmark in Instrument Sans 18px semibold; nav items as ghost buttons `size="sm"`.
- **Active state:** `bg-accent text-accent-foreground` (wash fill) on current route prefix match.
- **Mobile:** Board FAB (create ticket) fixed bottom-right, 48px circle, `shadow-lg`, primary fill. Filter/sort via sheets, not persistent side nav.

### Ticket Card (signature)

- **Structure:** Small card, title row with actions menu, optional warning badges, 2-line preview clamp, chip row, avatar row for contact/assignee.
- **Density:** `text-sm` title, `text-xs` preview, `text-[10px]` badges. Unread pill:absolute top-right, solid red-600, white text, 2px canvas border to separate from card ring.
- **Drag:** Grab cursor on sortable cards; opacity 0 on source while dragging; overlay clone carries `shadow-lg`.

### Lane Column (signature)

- **Structure:** 288px fixed width (`w-72`), wash/50 background, inset ring, status dot + name + count badge in header.
- **Drop target:** Dashed primary/35 border, primary/5 fill placeholder during drag.
- **Scroll:** Inner column scrolls tickets with 8px gap; infinite load via intersection sentinel.

## 6. Do's and Don'ts

Concrete guardrails for agents and contributors. PRODUCT.md anti-references are enforced here verbatim.

### Do:

- **Do** keep body backgrounds pure canvas or cool wash; tint neutrals toward brand hue at chroma ≤0.015 only.
- **Do** use Instrument Sans for headings and Source Sans 3 for body; reserve Geist Mono for API/MCP/code strings.
- **Do** show agent vs human actor, channel, and status on ticket cards without opening the modal.
- **Do** use ring borders and tonal washes for depth at rest; add shadow only on drag, overlay, or FAB.
- **Do** keep controls at 32px height with visible focus rings and `prefers-reduced-motion` safe transitions.
- **Do** label buttons with verb + object ("Save changes", "Delete ticket", "Create ticket").

### Don't:

- **Don't** use generic SaaS helpdesk patterns: purple gradients, hero metrics, identical feature-card grids, or marketing filler inside admin surfaces.
- **Don't** use AI-slop scaffolding: warm cream body backgrounds, gradient text, small-caps eyebrows on every section, or numbered section markers as decoration.
- **Don't** use consumer/playful UI: mascot energy, bubbly oversized radii, loud accent colors, or delight-for-delight's-sake motion.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, or alerts.
- **Don't** apply saturated color as page background or primary brand wash; status and semantic badges earn hue.
- **Don't** add subtitles under page titles that restate the heading; descriptions teach constraints only.
- **Don't** use bounce or elastic easing; transitions use ease-out curves, instant under `prefers-reduced-motion: reduce`.
