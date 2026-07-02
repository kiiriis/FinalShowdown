# Design

Visual system for Final Showdown — "race control" for a private job-hunt league.

## Theme

Three first-class themes sharing one token contract (CSS vars in `app/globals.css`, consumed as `hsl(var(--x))` via Tailwind):

| Token | Paper (light) | Graphite (gray) | Carbon (dark) |
|---|---|---|---|
| `--background` | cool near-white, blue-tinted | mid graphite `~#232429` | blue-cast near-black `~#0C0D12` |
| `--card` | pure white | one step lighter | one step lighter |
| `--primary` | cobalt `hsl(233 64% 48%)` | periwinkle `hsl(231 96% 74%)` | periwinkle `hsl(231 100% 77%)` |
| `--gold` | bronze-gold (dark, AA on light) | warm gold | warm gold |

- Graphite and Carbon are both dark-family: Tailwind `dark:` variants apply to both (`darkMode: variant` matching `.dark` and `.graphite`).
- Accent (cobalt/periwinkle) is for primary actions, selection, and live state only. **Gold is reserved for the leader / offers / the trophy** — it is the reward color and must stay scarce.
- Neutrals are tinted toward the brand hue (~230), never warm-by-default.

## Typography

- **Display — Bricolage Grotesque** (`--font-display`): page h1s, standings numbers, KPI values. Never in buttons, labels, or body.
- **Body/UI — Instrument Sans** (`--font-sans`): everything else.
- **Data — JetBrains Mono** (`--font-mono`): dates, counts, table column headers, kbd hints, position markers (P1–P5). Always `tabular-nums`.
- Scale is fixed rem, ratio ~1.2. Display tracking ≥ -0.02em.

## Signature

The **standings** treatment on the dashboard: mono position markers (P1 gold), per-user pace bars scaled to the leader, count-up totals. Echoed nowhere else at full volume — day-group headers on the jobs board carry only a quiet mono date + count chip.

## Components

- shadcn/radix primitives, radius `0.625rem`, hairline borders, flat surfaces (shadow only on overlays and primary buttons).
- Status pills: tinted bg + readable text + label (never color-only), consistent across board/dialogs/charts.
- Skeletons for loading (shimmer respects reduced motion).

## Motion

- Tokens in `lib/motion.ts` (expo-out, 150/250/400ms). State feedback only: pill morph, nav `layoutId` indicator, count-up, pace-bar grow, row fade-out on delete.
- No page-load choreography beyond a ≤300ms fade/rise; reduced motion collapses everything to near-instant.

## Charts (Recharts)

- Structure colors from tokens (`hsl(var(--border))`, `hsl(var(--muted-foreground))`).
- Per-user series palette and status colors defined in one place; mid-lightness hues legible on all three themes; leader/offer = gold family.
