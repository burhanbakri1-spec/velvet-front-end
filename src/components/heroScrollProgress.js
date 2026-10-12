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

const MAX_OLDER_STACK = HERO_SLICE * 3;

function roundShift(value) {
  return Math.round(value) || 0;
}

/**
 * Two desktop hero models. Scroll position picks the frame. Direction picks
 * which model. They are not the same motion.
 *
 * Down is the document sequence: hero, product strip, next hero, product
 * strip. Nothing is shifted, clipped, or concealed, so the strip stays in
 * the slide and a pause leaves the page where the scroll stopped.
 *
 * Up is a deck under the header. The full hero is the first banner whose top
 * is still below the header. Every hero above it is a horizontal slice in
 * the band that opened above that hero. Older slices stay thin and fade out
 * as the nearest slice grows to the full banner. Strips between those layers
 * are concealed until the scroll turns downward again.
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
  if (mode !== 'up' || heroes.length < 2 || viewportHeight <= 0) return motion;

  const focus = scrollY + header;
  let current = -1;
  for (let index = 0; index < heroes.length; index += 1) {
    if (heroes[index].height > 0 && heroes[index].top >= focus - 0.5) {
      current = index;
      break;
    }
  }
  if (current <= 0) return motion;

  const naturalTop = heroes[current].top - scrollY;
  const band = naturalTop - header;
  if (band <= 0.5) return motion;

  const nearest = current - 1;
  const span = heroes[current].top - heroes[nearest].top;
  if (span <= 0 || heroes[nearest].height <= 0) return motion;

  const opened = Math.min(1, band / span);
  const fade = Math.sin(Math.PI * opened);
  const olderCount = nearest;
  const olderBudget = olderCount > 0
    ? fade * Math.min(MAX_OLDER_STACK, band * 0.5)
    : 0;
  const eachOlder = olderCount > 0 ? olderBudget / olderCount : 0;
  const heights = heroes.map(() => 0);

  for (let index = 0; index < nearest; index += 1) {
    if (heroes[index].height <= 0) continue;
    heights[index] = Math.min(HERO_SLICE, eachOlder, heroes[index].height);
  }
  const olderSum = heights.reduce((sum, value) => sum + value, 0);
  const visibleOlder = heights.slice(0, nearest).filter((value) => value >= 1).length;
  const overlap = HERO_SLICE_OVERLAP * visibleOlder;
  heights[nearest] = Math.max(0, Math.min(
    heroes[nearest].height,
    band - olderSum + overlap,
  ));

  let cursor = header;
  for (let index = 0; index < current; index += 1) {
    const visible = heights[index];
    if (visible < 1) {
      motion[index].stripHidden = true;
      continue;
    }
    const natural = heroes[index].top - scrollY;
    const tuck = index < nearest && heights[nearest] >= 1 ? HERO_SLICE_OVERLAP : 0;
    motion[index] = {
      shift: roundShift(cursor - (natural + heroes[index].height - visible)),
      clip: roundShift(heroes[index].height - visible),
      stripHidden: true,
      z: 4 + index,
    };
    cursor += visible - tuck;
  }

  motion[current].shift = roundShift(cursor - naturalTop);
  return motion;
}
