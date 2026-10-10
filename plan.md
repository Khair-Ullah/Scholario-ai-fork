# Hero 3D Card Set — Plan (6 images / 3 flip cards)

Status: **Approved — pending implementation**

## Goal
Turn the hero's single 3D flip card into a **set of 3 flip cards = 6 images**:
- Each card = **2 images** that flip between each other (3D page-turn/cube effect).
- The **3 cards animate independently** (different speed/offset and delays) so the combination looks dynamic.

## Current state
- `frontend/src/app/page.tsx` hero: one `.hero-flip` with `nav.jpg` (front) + `map.jpg` (back), looping `heroCube` keyframe (12s, `rotateY 0 → 180 → 360`).
- CSS lives in `frontend/src/app/globals.css`: `.hero-flip`, `.hero-flip-inner`, `.hero-face`, `.hero-face-back`, `.hero-visual`.
- Source images: `frontend/images/design/*.jfif` → copies in `frontend/public/images/design/*.jpg` (Next.js `public/` serving + image optimizer).

## Data
- Existing: `nav.jfif`, `map.jfif` (both 768×1376).
- To be added by user: **4 more images** → `frontend/images/design/` (total 6).

## Implementation steps

### 1. `plan.md` (this file)
- Write the plan (done here).

### 2. Images
- Copy all of `frontend/images/design/` → `frontend/public/images/design/` (rename `.jfif` → `.jpg`).
- Pairing (defaults, confirm at implementation time):
  - Card 1 = `nav` + `map` (center card, unchanged).
  - Card 2 = images 3 + 4 (name order).
  - Card 3 = images 5 + 6 (name order).
- If filenames differ from expectations, pair in the order the user lists.

### 3. CSS — `frontend/src/app/globals.css`
- Replace single `.hero-flip` with `.hero-stage` (fixed-size, `position: relative`, `perspective`).
- 3 cards, each:
  - `.hero-card` (absolute, sized `aspect-ratio: 768/1376`).
  - inner `.hero-card-inner` = `preserve-3d`, animated with shared `heroCube` keyframe.
  - two `.hero-face` (`.hero-face-back` has `rotateY(180deg)`), `backface-visibility: hidden`, rounded corners + shadow.
- Staggered animation: durations ~11s / 14s / 17s with negative `animation-delay` so flips are out of sync.
- "Fan" layout:
  - Card 1 centered in front.
  - Cards 2 & 3 behind/side: `translateZ(-60–90px)`, `translateX(±100–120px)`, slight `rotate(±5deg)`.
- Mobile: reduce offsets/spread, keep hero height ~350–420px, preserve orbit circles.
- Keep `prefers-reduced-motion` override (existing global rule covers it).

### 4. Markup — `frontend/src/app/page.tsx`
- Data-driven render: array of 6 image paths → 3 cards × 2 faces.
- Front faces `priority`, all via `next/image`.

### 5. Verify
- Restart `frontend` container (Windows volume watch does NOT hot-reload — restart required after file changes).
- Check home returns 200 and all 6 images are served/optimized.
- Run `npm run lint` + `npm run build`.

## Notes / gotchas
- `.jfif` is not accepted by the Next image optimizer → always copy as `.jpg`.
- `.next` dev cache can get corrupted if dev server and `next build` run together; if build throws TS errors in `.next/dev/types/*.d.ts`, clear `.next` (stop container, remove volume contents, rebuild).
- Admin sidebar intentionally left unchanged (dark theme, shield brand).