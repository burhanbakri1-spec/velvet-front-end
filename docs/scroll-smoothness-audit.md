# Storefront motion audit — 2026-10-22

Badge commits are local only: frontend 3f620a7 (feat: unify product badge presentation),
API/CPanel aa59c3f (feat: support unified product badge modes). Each contains exactly
the 11 documented badge files. Frontend was clean immediately after that commit.
Backend retained only its two pre-existing tracked changes and 97 untracked entries.
Protected file SHA-256 values still match the pre-badge snapshot. Nothing was pushed.

## Confirmed avoidable costs

1. A single hero update rebuilt the same slide geometry repeatedly through
   stageSlidePos, stageReleaseBox and heroStageMotion. Release also calculated a
   second full set of poses. Upward deck/clipping and height release run on this
   path during reversals, so the duplicate work competes with the next input frame.
2. Parent ResizeObserver fired when the approved release animation changed the
   shell height. It scheduled a full measure of header style, strip heights and
   shell position even when the input geometry had not changed.
3. Measurement wrote will-change before reading shell geometry, creating a
   read-after-write ordering hazard. Per-frame attributes were also written with
   unchanged values. Initial refs were acquired after the first attempted slide
   measurement, and the first scheduled frame measured again unnecessarily.
4. CSSOM serializes zero units and inset shorthand. Remembering our previous
   writes avoids repeated style serialization/assignment on held or parked slides.

These are code-level sources of unnecessary work, not proof that every perceived
GPU/paint stall has the same cause. No stale-direction or competing-RAF defect was
confirmed. The existing direction latch, thresholds and transitions remain intact.

## Exact smoothness files

- src/components/useHeroStageMotion.js: cache shell/stage refs before measurement;
  finish geometry reads before writes; filter self-induced resize notifications;
  observe actual strip sizes; invalidate on real resize/load/DOM changes; suppress
  unchanged input/attributes/style writes. Existing one-RAF scheduler, passive
  listener, direction latch and cleanup remain. No additional motion loop.
- src/components/heroScrollProgress.js: optional cached geometry and poses shared
  across existing functions. Every formula, ordering and constant is unchanged.
- test/hero-motion-equivalence.test.js: approved pre-optimization fingerprint across
  sizes, mixed strips, holds, both directions and terminal release; cache parity.
- test/hero-stage-runtime.test.js: latest-input RAF coalescing, no scroll geometry
  reads, observer invalidation, parked-write suppression, cleanup/reduced motion.
- scripts/profile-motion.mjs: local-only reproducible browser audit harness. It
  caches a read-only public catalog GET (427 products), stubs other API calls and
  records counters/poses. It is not imported by the app or production build.
- docs/scroll-smoothness-audit.md: this report.

No CSS, header, product layout, badge, naming, PDP, content, environment file,
analytics, backend or CPanel source was modified for smoothness.

## Method and output parity

Same local Vite runtime and public catalog at 375×812, 390×844, 768×1024,
1366×768 and 1440×900, before and after, on Home, Brand/baby, Shop and
Balloon-Powered Cars PDP. Each scenario includes slow down/up, fast down/up,
immediate down→up/up→down and short reversals, plus release-region samples on
Home/Brand. Home uses the existing ?view=showcases preview to skip intro waiting;
the intro sequence code was not changed. This samples motion, not a timed tour of
every brand scene.

All 20 matching cases (1080 checkpoints) have identical scroll positions,
transforms, clipping, z-index, concealed flags and stage box heights. Shell span
strings differ by at most 0.0001220703125px from floating-point layout reads,
below a rendered pixel. Product card positions/widths match. All cases have no
horizontal overflow. Mobile Shop remains two columns at 375 and 390.

Native browser scroll actions (single/multiple pages and rapid reversal) were
also exercised after implementation on all four surfaces at 375, 390, 1366 and
1440. Desktop Categories and Arabic mobile menu were checked; the open menu keeps
the header visible, and mobile body retains its existing scroll-lock class.
Arabic RTL Home and Shop, localized badges, and desktop English LTR were checked.
Home/Brand output parity is confirmed; PDP/card geometry and badge tests pass.

## Home measured work

| Viewport | Geometry builds before → after | Measures before → after | DOM attributes before → after | Two-RAF step p95 ms before → after |
|---|---:|---:|---:|---:|
| 375×812 | 341 → 15 | 41 → 15 | 172 → 24 | 176.8 → 105.4 |
| 390×844 | 309 → 3 | 29 → 3 | 162 → 24 | 163.1 → 120.4 |
| 768×1024 | 315 → 4 | 31 → 4 | 166 → 26 | 187.5 → 111.9 |
| 1366×768 | 259 → 11 | 12 → 11 | 148 → 24 | 93.2 → 91.7 |
| 1440×900 | 232 → 1 | 5 → 1 | 138 → 24 | 96.9 → 85.2 |

## Brand measured work

| Viewport | Geometry builds before → after | Measures before → after | DOM attributes before → after | Two-RAF step p95 ms before → after |
|---|---:|---:|---:|---:|
| 375×812 | 309 → 5 | 29 → 5 | 162 → 25 | 49 → 60.2 |
| 390×844 | 309 → 1 | 29 → 1 | 162 → 24 | 63.4 → 53.1 |
| 768×1024 | 322 → 2 | 36 → 2 | 166 → 26 | 55.6 → 60 |
| 1366×768 | 228 → 1 | 5 → 1 | 134 → 22 | 46.3 → 53.9 |
| 1440×900 | 228 → 1 | 5 → 1 | 134 → 22 | 48.4 → 58.8 |

Shop/PDP do not run hero code. React counters show header updates when its
visibility changes; product cards do not rerender during these scroll traces.
There was no measured reason for a React tree refactor. Header behavior is unchanged.

## Media, CSS and limitations

Animated poses already use translate3d/clip-path with CSS transitions disabled on
the stage. Existing media aspect ratios, image decode/loading rules, video logic,
backdrop effects, shadows and selected will-change hints were retained. Image load
still invalidates geometry, and actual strip-size changes are observed. No media
quality reduction or speculative CSS/lazy-loading change was made.

Browser available: in-app Chromium; no connected standalone Chrome DevTools,
GPU/layer trace, CPU throttle or physical touch/inertial-phone measurement.
Viewport emulation is not a physical mobile device. Native scrolling is supported;
the keyboard PageDown automation attempt timed out, so it is not counted as a
completed verification. The profiler counts read-after-write ordering, not browser
forced-layout trace events. Prototype counters and instrumentation have overhead.
Two-RAF-step p95 includes two animation frames and media/network variability; it is
not single-frame CPU time or FPS. Some timings improved and some regressed between
runs. The reliable result is reduced geometry/DOM work plus preserved output,
not a universal frame-rate or perceptual-smoothness guarantee. Physical phone and
GPU profiling remain useful follow-up validation.

No new console error/warning was captured on the final routes. Existing analytics
was stubbed in this local harness and was not changed or re-audited.

## Verification and Git

npm test: 511 pass / 0 fail (including badge and existing approved-motion tests).
npm run build: pass; existing >500kB bundle warning remains.
git diff --check: clean. Smoothness changes are unstaged and uncommitted.
Backend/CPanel remains at aa59c3f with its original two modified files and 97
untracked entries. No push or deployment. Raw before/after reports and summary.json
are delivered separately as audit artifacts, not production assets.

Raw comparison artifact: [summary.json](C:/Users/jamal2000/.codex/visualizations/2026/10/22/01a163c0-0b57-7211-9434-17f96be93cae/velvet-motion-audit/summary.json).
