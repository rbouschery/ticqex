---
target: board
total_score: 26
p0_count: 0
p1_count: 2
p2_count: 3
timestamp: 2026-06-05T12-28-08Z
slug: src-components-board
---
# Critique: Board (`src/components/board`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton lanes, move-error alerts, unread pills; no realtime connection indicator |
| 2 | Match System / Real World | 3 | Familiar Kanban; "Custom" sort label and filter operators assume tool fluency |
| 3 | User Control and Freedom | 3 | Clear filters, drag cancel, delete confirm; no undo for status moves |
| 4 | Consistency and Standards | 3 | shadcn vocabulary holds; card open path mixes click-card, Open button, and drag |
| 5 | Error Prevention | 3 | Delete dialog, optimistic rollback on failure |
| 6 | Recognition Rather Than Recall | 2 | Filter chips help; sort modes and lane purpose (e.g. Human Review) need recall |
| 7 | Flexibility and Efficiency | 2 | Drag reorder and copy context; no keyboard shortcuts or bulk triage |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained ink palette, dense cards; redundant "Open" pill competes with title |
| 9 | Error Recovery | 3 | Move/delete errors surface in destructive alert with plain message |
| 10 | Help and Documentation | 1 | No board-level guidance for first-run solo operators |
| **Total** | | **26/40** | **Acceptable** |

**Cognitive load:** 3 checklist failures (single focus under active filters, >4 options in filter popover, sort mode recall). Moderate load.

## Anti-Patterns Verdict

**LLM assessment:** Does not read as AI slop. Monochrome ink-on-canvas, no cream body, no gradient text, no section eyebrows, no purple SaaS chrome. Reads closer to Linear/infra admin than generic helpdesk. The product slop test passes on familiarity; strangeness is minor (dual open affordances, weak agent signaling).

**Deterministic scan:** `detect.mjs` on `src/components/board` and `src/app/board` returned **0 findings** (exit 0).

**Browser visualization:** Live `detect.js` injection was not completed (script injection blocked in this environment). Assessment used accessibility snapshot and screenshot at `http://localhost:3000/board` instead. **No reliable user-visible overlay is available for this run.**

## Overall Impression

The board is a credible control-room surface: fast to scan, appropriately dense, and free of the anti-references in PRODUCT.md. The single biggest opportunity is **agent-human parity on the card itself**. Your stated design goal is that agents are first-class operators, but cards today only expose channel/origin (Email, API) and people tags, not who last acted or whether the ticket awaits human judgment. Fixing that one gap would align the UI with the product thesis without adding SaaS decoration.

## What's Working

1. **Restrained visual system** — Lane washes, ring-bordered cards, and status-colored dots carry structure without shadow clutter or brand-purple noise. Matches "The Control Room" north star.
2. **Operator toolbar** — Search, filter chips with clear-all, sort, and create are co-located and scale to mobile via sheets + FAB without redesigning the mental model.
3. **State feedback on manipulation** — Drag overlay with shadow lift, dashed drop placeholder, skeleton lane count memory, and destructive alerts for move/delete failures make the system feel responsive.

## Priority Issues

### [P1] Agent activity is invisible on cards
- **Why it matters:** Solo operators supervising agents cannot triage from the board; they must open every ticket to see if an agent replied, is waiting, or needs human review. This directly contradicts PRODUCT.md principle #1 and your init design goal.
- **Fix:** Add a card-level signal for last actor (agent vs human), last activity time, and/or "needs review" state. Surface it as a compact badge or metadata row, not a new card grid.
- **Suggested command:** `/impeccable colorize board` or `/impeccable polish ticket-card`

### [P1] Drag-first cards block keyboard and focus clarity
- **Why it matters:** `@dnd-kit/sortable` spreads `role="button"` and listeners on the card wrapper while inner "Open" and menu buttons nest inside. The wrapper also sets `focus-visible:outline-none`, removing focus cues. Keyboard users cannot reorder and get ambiguous tab order.
- **Fix:** Separate drag handle from card body; restore focus-visible on the interactive open target; provide a non-drag status change path (already in menu) and document keyboard flow.
- **Suggested command:** `/impeccable audit board` then `/impeccable harden ticket-card`

### [P2] Empty lanes are silent
- **Why it matters:** "Done" and "Human Review" columns render as blank wells. A solo dev cannot tell if the lane is broken, loading, or intentionally empty, or what belongs there.
- **Fix:** Per-lane empty state: one line of purpose ("Tickets agents flagged for your review") plus optional drop hint when dragging.
- **Suggested command:** `/impeccable onboard board`

### [P2] Competing open affordances on the same card
- **Why it matters:** Screenshot shows an "Open" control, a whole-card click handler, and drag-on-card. Users hesitate on whether click opens or initiates drag; the accessibility tree exposes the entire card as a button-like surface.
- **Fix:** Pick one primary open path. Prefer explicit "Open" + drag handle only, or click-to-open with drag restricted to a handle icon.
- **Suggested command:** `/impeccable distill ticket-card`

### [P2] No power-user accelerators
- **Why it matters:** Alex-style solo operators living in this board daily have no `/` search focus, `n` new ticket, or arrow navigation between cards.
- **Fix:** Add a small keyboard map (3–5 bindings) scoped to the board route.
- **Suggested command:** `/impeccable harden kanban-board`

## Persona Red Flags

**Alex (Power User):** No keyboard shortcuts. Status change requires menu drill-down or drag. Cannot batch-move or multi-select tickets. "Copy context" is buried in per-card menu.

**Sam (Accessibility):** Card wrapper suppresses `focus-visible`. Sortable drag is pointer-only. Snapshot shows nested interactive controls inside a button-like card surface. Unread count uses red alone without redundant text beyond aria-label (label exists; good).

**Solo Operator "Dev" (project-specific):** Cannot see agent vs human last action on the board. "Human Review" lane name implies agent workflow but empty column teaches nothing. Must open modal to supervise agent work.

## Minor Observations

- Search no-results copy is clear but easy to miss (small muted line above lanes).
- `text-[10px]` badges on cards push legibility; acceptable for density but borderline for WCAG large-text thresholds.
- Desktop toolbar hides "New Ticket" label below `sm` breakpoint on the header button while mobile uses icon-only FAB (consistent intent, different labels).
- Whole-board capped/subset states are not surfaced in the header when `capped` is true.

## Questions to Consider

- What if the card footer always showed "Last: Agent · 4m ago" as the primary scan line?
- Does drag-to-reorder need to live on the whole card, or only on a grip the solo operator learns once?
- What would make "Human Review" self-explanatory the first time an agent moves a ticket there?
