/** Upward travel required before reverse hero motion replaces normal flow. */
export const HERO_DIRECTION_THRESHOLD = 36;

/**
 * Scroll direction for desktop heroes. Tiny wheel deltas stay in the current
 * mode until they accumulate past the threshold, so the reverse effect cannot
 * leak into ordinary downward scrolling.
 */
export function stepHeroScrollDirection(state, delta, threshold = HERO_DIRECTION_THRESHOLD) {
  let accum = state?.accum || 0;
  let mode = state?.mode === 'up' ? 'up' : 'down';
  if (delta) {
    accum = accum !== 0 && Math.sign(delta) !== Math.sign(accum) ? delta : accum + delta;
  }
  if (accum >= threshold) {
    mode = 'down';
    accum = threshold;
  } else if (accum <= -threshold) {
    mode = 'up';
    accum = -threshold;
  }
  return { mode, accum };
}

/**
 * Desktop reverse motion for one hero pair. Scroll position alone decides the frame.
 *
 * The current hero is the first banner whose top is at or below the header.
 * Distance below that line is the shared progress:
 *   0 = current hero flush with the header
 *   previous height = previous hero fully revealed, 1:1 with that distance
 * The previous hero is shifted only enough to close the product-strip gap, so its
 * bottom meets the current hero and it enters from above immediately. It is never
 * clipped, and a hero the header still cuts through is left in normal flow.
 * Strip height delays only the next pair, after this one has reached its natural frame.
 */
export function heroStageMotion({ heroes, scrollY, header, viewportHeight }) {
  const motion = heroes.map(() => ({ shift: 0, clip: 0, stripHidden: false }));
  if (!Array.isArray(heroes) || heroes.length < 2 || viewportHeight <= 0) return motion;

  let active = -1;
  for (let index = 0; index < heroes.length; index += 1) {
    if (heroes[index].height > 0 && heroes[index].top - scrollY >= header - 0.5) {
      active = index;
      break;
    }
  }
  if (active <= 0) return motion;

  const current = heroes[active];
  const previous = heroes[active - 1];
  const height = previous.height;
  if (height <= 0) return motion;

  const gap = Math.max(0, current.top - (previous.top + height));
  const distance = (current.top - header) - scrollY;
  if (distance <= 0.5 || distance > height + gap + 0.5) return motion;

  const previousTop = previous.top - scrollY;
  const seam = current.top - scrollY;
  const headerCutsPrevious = previousTop < header - 0.5 && previousTop + height > header + 0.5;
  // The header is still inside this hero, and the next seam is more than one
  // hero below it. Leave that hero in normal flow instead of pinning or slicing it.
  if (headerCutsPrevious && seam > header + height) return motion;

  const settling = Math.max(0, distance - height);
  const shift = Math.round(Math.max(0, gap - settling));
  motion[active - 1] = {
    shift,
    clip: 0,
    stripHidden: gap > 0 && distance < height + gap - 0.5,
  };
  return motion;
}
