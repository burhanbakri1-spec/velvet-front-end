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
 * Desktop hero motion is a pure function of scroll position.
 *
 * The hero just below the header is the moving hero. Scroll distance below
 * that line reveals earlier heroes from the header down. While a product
 * strip sits between them, that strip is covered and its distance is given
 * back before the next hero is allowed to enter, so the arriving hero meets
 * its natural position instead of jumping.
 */
export function heroStageMotion({ heroes, scrollY, header, viewportHeight }) {
  const motion = heroes.map(() => ({ shift: 0, clip: 0, stripHidden: false }));
  if (heroes.length < 2 || viewportHeight <= 0) return motion;

  const tops = heroes.map((hero) => hero.top - scrollY);
  let moving = -1;
  let movingTop = Infinity;
  tops.forEach((top, index) => {
    if (heroes[index].height <= 0) return;
    if (top >= header - 0.5 && top < movingTop) {
      movingTop = top;
      moving = index;
    }
  });
  if (moving <= 0) return motion;

  let band = movingTop - header;
  for (let index = moving - 1; index >= 0 && band > 0.5; index -= 1) {
    const height = heroes[index].height;
    if (height <= 0) break;
    const gap = Math.max(0, tops[index + 1] - (tops[index] + height));
    const intoStrip = Math.max(0, band - height);
    let visualTop = header + intoStrip;
    if (gap > 0 && intoStrip > 0) {
      const absorb = Math.min(1, intoStrip / gap);
      visualTop += (tops[index] - visualTop) * absorb;
    }
    const revealed = Math.min(band, height);
    const shift = Math.round(visualTop - tops[index]);
    const clip = Math.round(Math.max(0, height - revealed));
    motion[index] = {
      shift,
      clip,
        stripHidden: clip !== 0,
    };
    band = Math.max(0, band - height - gap);
  }

  return motion;
}
