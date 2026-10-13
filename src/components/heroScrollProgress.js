/**
 * Scroll direction picks which desktop hero model runs.
 * Any downward delta leaves the upward deck immediately.
 * Any upward delta enters it. A zero delta keeps the current model.
 * Positions come only from the caller's cached document tops.
 */
export function stepHeroDirection(mode, delta) {
  if (delta > 0) return 'down';
  if (delta < 0) return 'up';
  return mode === 'up' ? 'up' : 'down';
}

/** Visible card edge for an older hero in the upward deck. */
export const HERO_SLICE = 72;

/** How far each older card tucks under the card below it. */
export const HERO_SLICE_OVERLAP = 8;

/**
 * The brand title sits about 73px above the banner bottom.
 * This keeps that title inside the thin slice instead of leaving a blank color band.
 */
export const HERO_SLICE_FOOT = 36;

/** How strongly a downward span lingers, then sweeps. Stays below 1 so the column never reverses. */
const SLIDE_WEIGHT = 0.82;

function roundShift(value) {
  return Math.round(value) || 0;
}

function sliceFrame(height, visible) {
  const room = Math.max(0, height - visible);
  const foot = Math.min(HERO_SLICE_FOOT, room);
  return {
    clip: roundShift(Math.max(0, height - foot - visible)),
    foot: roundShift(foot),
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/**
 * Visual travel through one downward span, as a fraction of that span.
 * 0 at the start, 1 at the end, slope 1 at both ends.
 * The first half moves slower than the scrollbar so the current hero lingers.
 * The second half moves faster, so the strip and the next hero sweep in.
 */
export function heroSlideTravel(progress) {
  const turn = 2 * Math.PI * clamp01(progress);
  return clamp01(progress) - (SLIDE_WEIGHT / (2 * Math.PI)) * (1 - Math.cos(turn));
}

/**
 * Down is a viewport slider. The outgoing hero and its product strip linger,
 * then sweep upward. The next hero starts at the fold and slides up from
 * below until it meets that strip. Shift is zero at every hero boundary.
 *
 * Up is a deck of thin card edges under the header. The nearest edge grows
 * into the full hero. Older edges stay one slice tall. The full hero sits
 * on the stack, so native scroll is cancelled and cannot fight the deck.
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
    const outgoing = heroes[index - 1];
    const incoming = heroes[index];
    const span = incoming.top - outgoing.top;
    if (span <= 0 || outgoing.height <= 0) continue;
    if (focus < outgoing.top || focus >= incoming.top) continue;

    const progress = clamp01((focus - outgoing.top) / span);
    const travel = heroSlideTravel(progress);
    const columnShift = (progress - travel) * span;
    const strip = Math.max(0, span - outgoing.height);
    const slack = Math.max(0, visible - outgoing.height - strip);
    const approach = smoothstep(progress / 0.55);
    const entrance = slack * (1 - approach);
    let nextSlack = 0;
    if (index + 1 < heroes.length && heroes[index].height > 0) {
      const following = heroes[index + 1];
      const nextSpan = following.top - incoming.top;
      const nextStrip = Math.max(0, nextSpan - incoming.height);
      nextSlack = Math.max(0, visible - incoming.height - nextStrip);
    }
    const park = nextSlack * approach;

    for (let cursor = 0; cursor < heroes.length; cursor += 1) {
      let extra = 0;
      if (cursor === index) extra = entrance;
      else if (cursor > index) extra = entrance + park;
      motion[cursor].shift = roundShift(columnShift + extra);
    }
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
  const grow = smoothstep((opened - 0.5) / 0.5);
  const nearestHeight = distance <= HERO_SLICE
    ? distance
    : Math.min(heroes[nearest].height, HERO_SLICE + grow * (heroes[nearest].height - HERO_SLICE));

  const heights = heroes.map(() => 0);
  for (let index = 0; index < nearest; index += 1) {
    if (heroes[index].height <= 0) continue;
    const order = nearest - 1 - index;
    const start = (order + 1) * HERO_SLICE * 0.55;
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
    const natural = heroes[index].top - scrollY;
    const frame = sliceFrame(heroes[index].height, visible);
    motion[index] = {
      shift: roundShift(cursor - natural - frame.clip),
      clip: frame.clip,
      foot: frame.foot,
      stripHidden: true,
      z: 4 + index,
    };
    cursor += visible - HERO_SLICE_OVERLAP;
  }

  const nearestNatural = heroes[nearest].top - scrollY;
  const nearestFrame = sliceFrame(heroes[nearest].height, nearestHeight);
  motion[nearest] = {
    shift: roundShift(cursor - nearestNatural - nearestFrame.clip),
    clip: nearestFrame.clip,
    foot: nearestFrame.foot,
    stripHidden: true,
    z: 4 + nearest,
  };
  cursor += nearestHeight;

  const featuredShift = roundShift(cursor - (heroes[featured].top - scrollY));
  for (let index = featured; index < heroes.length; index += 1) {
    motion[index].shift = featuredShift;
  }
  return motion;
}
