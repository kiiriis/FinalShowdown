# Product

## Register

product

## Users

Five friends (Krish + 4) racing each other through the new-grad job hunt. They live in this app daily — often multiple short sessions a day — pasting job links, flipping application statuses, requesting referrals from each other, and checking who's ahead. Power users: they know the keyboard shortcuts (/, N, D) and scan hundreds of rows fast.

## Product Purpose

A shared job-application tracker ("Final Showdown") that replaced a group spreadsheet. It keeps one canonical list of jobs, per-person tracking (applied / referral / cold email / follow-ups), and a dashboard that turns the grind into a friendly competition. Success = every application logged with zero friction, and the standings keep everyone motivated.

## Brand Personality

Competitive, precise, understated. The vibe of a race-control timing screen: dense data handled calmly, one confident accent, gold reserved for whoever's leading. It should feel like a professional tool the five of them are proud to open — not a template.

## Anti-references

- The 2024 shadcn/AI default: violet→sky gradients, gradient text, radial blob backgrounds, glassmorphism cards.
- Consumer job boards (LinkedIn/Indeed) — this is a private league, not a feed.
- Anything cream/terracotta "editorial" or neon-on-black "terminal" — the two other AI default looks.

## Design Principles

1. **Data is the interface.** Tabular numbers, monospace for dates/counts/positions; the content rows carry the design, decoration stays out of the way.
2. **The race is the identity.** Standings, position markers, and gold-for-the-leader are the one place the design gets loud.
3. **Fast hands first.** Every frequent action stays one click/keystroke away; motion is 150–250ms state feedback, never choreography.
4. **Three rooms, one house.** Paper (light), Graphite (gray), and Carbon (dark) themes share identical structure and contrast discipline — switching themes never re-ranks visual hierarchy.

## Accessibility & Inclusion

- Body text ≥ 4.5:1 contrast in all three themes; status is never conveyed by color alone (pills carry labels).
- `prefers-reduced-motion` fully honored (CSS + framer-motion `MotionConfig reducedMotion="user"`).
- Keyboard: visible focus rings, shortcuts never trap typing fields.
