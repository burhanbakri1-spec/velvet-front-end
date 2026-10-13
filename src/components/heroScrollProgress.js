/**
 * Scroll direction picks which desktop hero model runs.
 * Any downward delta leaves the upward deck immediately.
 * Any upward delta enters it. A zero delta keeps the current model.
 */
export function stepHeroDirection(mode, delta) {
  if (delta > 0) return 'down';
  if (delta < 0) return 'up';
  return mode === 'up' ? 'up' : 'down';
}

/** Thin card height for an older hero in the upward deck. */
export const HERO_SLICE = 96;

/** How far each older card tucks under the card below it. */
export const HERO_SLICE_OVERLAP = 8;

function roundShift(value) {
  return Math.round(value) || 0;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/**
 * Down is a vertical slide. Every hero shares one temporary upward offset,
 * and each product strip is translated by that same amount, so the column
 * stays glued. The offset is zero, with zero slope, at both ends of a span.
 * Mid-span the column travels faster than document scroll.
 *
 * Up is a deck. The full hero is the first banner still below the header.
 * Earlier heroes are thin slices stacked under the header. They slide in
 * from height zero. The nearest slice keeps growing until it is the full
 * hero. Older slices stay thin, then slide up under the header instead of
 * popping away. The full hero is pushed down by the stack.
 */
export function heroStageMotion({
  heroes,
  scrollY,
  header,
  viewportHeight,
  mode = 'down',
}) {
  if (!Array.isArray(heroes)) return [];
  const motion = heroes.map(() => ({ shift: 0, clip: 0, stripHidden: false }));
  if (heroes.length < 2 || viewportHeight <= 0) return motion;
  if (mode !== 'up') return downSlide(heroes, scrollY, header, viewportHeight, motion);
  return upDeck(heroes, scrollY, header, motion);
}

function downSlide(heroes, scrollY, header, viewportHeight, motion) {
  const focus = scrollY + header;
  const visible = viewportHeight - header;
  if (visible <= 0) return motion;

  for (let index = 1; index < heroes.length; index += 1) {
    const previous = heroes[index - 1];
    const span = heroes[index].top - previous.top;
    if (span <= 0 || previous.height <= 0) continue;
    if (focus < previous.top || focus >= heroes[index].top) continue;
    const progress = clamp01((focus - previous.top) / span);
    // Zero slope at both ends, so the column is moving at normal scroll
    // speed when a hero arrives and when it leaves. The sine hump makes
    // the whole column — hero, strip, next hero — travel faster mid-span.
    const wave = Math.sin(Math.PI * progress) ** 2;
    const travel = Math.min(span, visible) * 0.2;
    const shift = roundShift(-travel * wave);
    for (let cursor = 0; cursor < heroes.length; cursor += 1) motion[cursor].shift = shift;
    break;
  }
  return motion;
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
  const gap = Math.max(0, span - heroes[nearest].height);
  const growRoom = Math.max(1, span - HERO_SLICE);
  const thin = Math.min(HERO_SLICE, distance);
  const grow = clamp01((distance - HERO_SLICE) / growRoom);
  const nearestHeight = Math.min(
    heroes[nearest].height,
    thin + grow * (heroes[nearest].height - thin),
  );
  const heights = heroes.map(() => 0);
  for (let index = 0; index < nearest; index += 1) {
    if (heroes[index].height <= 0) continue;
    const order = nearest - 1 - index;
    const start = order * (HERO_SLICE * 0.5);
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
  const lift = smoothstep((opened - 0.55) / 0.45) * olderStack;
  let cursor = header - lift;
  let placed = 0;

  for (let index = 0; index < nearest; index += 1) {
    const visible = heights[index];
    motion[index].stripHidden = true;
    if (visible < 1) continue;
    const natural = heroes[index].top - scrollY;
    motion[index] = {
      shift: roundShift(cursor - (natural + heroes[index].height - visible)),
      clip: roundShift(heroes[index].height - visible),
      stripHidden: true,
      z: 4 + index,
    };
    placed += 1;
    cursor += visible - (placed < seenOlder ? HERO_SLICE_OVERLAP : 0);
  }

  const nearestNatural = heroes[nearest].top - scrollY;
  const nearestClip = Math.max(0, heroes[nearest].height - nearestHeight);
  motion[nearest] = {
    shift: roundShift(cursor - nearestNatural - nearestClip),
    clip: roundShift(nearestClip),
    stripHidden: true,
    z: 4 + nearest,
  };

  const featuredTop = cursor + nearestHeight + opened * gap;
  const featuredNatural = heroes[featured].top - scrollY;
  const featuredShift = roundShift(featuredTop - featuredNatural);
  for (let index = featured; index < heroes.length; index += 1) {
    motion[index].shift = featuredShift;
  }
  return motion;
}
