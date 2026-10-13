/**
 * Desktop hero motion.
 * Scroll direction chooses the model. A zero delta keeps the current model.
 * Every frame is a pure function of cached document tops and scroll position.
 * There is no time easing: each pixel of scroll maps to one visual position.
 */
export function stepHeroDirection(mode, delta) {
  if (delta > 0) return 'down';
  if (delta < 0) return 'up';
  return mode === 'up' ? 'up' : 'down';
}

/** Top edge of an older hero. The brand logo starts just below the top of the banner. */
export const HERO_SLICE = 68;

/** Keep the thin window on the logo instead of the empty gradient above it. */
const HERO_LOGO_TOP = 30;

/** Tuck between stacked card edges. */
export const HERO_SLICE_OVERLAP = 6;

function roundShift(value) {
  return Math.round(value) || 0;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Down is the document stage. Desktop heroes are exactly one viewport tall,
 * so native scroll already slides the current section up and the next section
 * in from below. Extra transforms would open a gap or fight that scroll.
 *
 * Up is a deck of thin TOP edges under the header. Bottom title and CTA are
 * clipped away. The nearest edge grows into the full hero. The full hero
 * sits on the stack.
 */
export function heroStageMotion({
  heroes,
  scrollY,
  header,
  viewportHeight,
  mode = 'down',
}) {
  if (!Array.isArray(heroes)) return [];
  const motion = heroes.map(() => ({ shift: 0, clip: 0, foot: 0, stripHidden: false }));
  if (heroes.length < 2 || viewportHeight <= 0) return motion;
  if (mode !== 'up') return downSlide(heroes, scrollY, header, viewportHeight, motion);
  return upDeck(heroes, scrollY, header, motion);
}

function downSlide(heroes, scrollY, header, viewportHeight, motion) {
  void heroes;
  void scrollY;
  void header;
  void viewportHeight;
  return motion;
}

function topEdge(height, visible) {
  const shown = Math.min(height, Math.max(0, visible));
  if (shown >= height - 1) return { clip: 0, foot: 0 };
  const clip = Math.min(HERO_LOGO_TOP, Math.max(0, height - shown));
  return {
    clip: roundShift(clip),
    foot: roundShift(Math.max(0, height - clip - shown)),
  };
}

function upDeck(heroes, scrollY, header, motion) {
  const focus = scrollY + header;
  let featured = -1;
  for (let index = 0; index < heroes.length; index += 1) {
    if (heroes[index].height > 0 && heroes[index].top >= focus - 0.5) {
      featured = index;
      break;
    }
  }
  if (featured <= 0) return motion;

  const nearest = featured - 1;
  const span = heroes[featured].top - heroes[nearest].top;
  const distance = heroes[featured].top - focus;
  if (span <= 0 || heroes[nearest].height <= 0 || distance <= 0.5) return motion;

  const opened = clamp01(distance / span);
  const grow = opened <= 0.5 ? 0 : clamp01((opened - 0.5) / 0.5);
  const nearestHeight = distance <= HERO_SLICE
    ? distance
    : Math.min(heroes[nearest].height, HERO_SLICE + grow * (heroes[nearest].height - HERO_SLICE));

  const heights = heroes.map(() => 0);
  for (let index = 0; index < nearest; index += 1) {
    if (heroes[index].height <= 0) continue;
    const order = nearest - 1 - index;
    const start = (order + 1) * HERO_SLICE * 0.5;
    const local = clamp01((distance - start) / HERO_SLICE);
    heights[index] = local * Math.min(HERO_SLICE, heroes[index].height);
  }

  let olderStack = 0;
  let seenOlder = 0;
  for (let index = 0; index < nearest; index += 1) {
    if (heights[index] < 1) continue;
    olderStack += heights[index];
    if (seenOlder > 0) olderStack -= HERO_SLICE_OVERLAP;
    seenOlder += 1;
  }
  const liftStack = Math.max(0, olderStack - (seenOlder > 0 ? HERO_SLICE_OVERLAP : 0));
  let cursor = header - grow * liftStack;

  for (let index = 0; index < nearest; index += 1) {
    const visible = heights[index];
    motion[index].stripHidden = true;
    if (visible < 1) continue;
    const edge = topEdge(heroes[index].height, visible);
    const natural = heroes[index].top - scrollY;
    motion[index] = {
      shift: roundShift(cursor - edge.clip - natural),
      clip: edge.clip,
      foot: edge.foot,
      stripHidden: true,
      z: 4 + index,
    };
    cursor += visible - HERO_SLICE_OVERLAP;
  }

  const nearestEdge = topEdge(heroes[nearest].height, nearestHeight);
  const nearestNatural = heroes[nearest].top - scrollY;
  motion[nearest] = {
    shift: roundShift(cursor - nearestEdge.clip - nearestNatural),
    clip: nearestEdge.clip,
    foot: nearestEdge.foot,
    stripHidden: true,
    z: 4 + nearest,
  };
  cursor += nearestHeight;

  const featuredShift = roundShift(cursor - (heroes[featured].top - scrollY));
  for (let index = featured; index < heroes.length; index += 1) {
    motion[index].shift = featuredShift;
    motion[index].stripHidden = false;
  }
  return motion;
}
