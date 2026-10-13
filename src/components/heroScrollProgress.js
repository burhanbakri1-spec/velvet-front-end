/**
 * Desktop hero motion inside a pinned stage.
 * The document only supplies scroll distance. Slide positions are a pure
 * function of that distance: no document-flow shift, no easing, no layout read.
 */
export function stepHeroDirection(mode, delta) {
  if (delta > 0) return 'down';
  if (delta < 0) return 'up';
  return mode === 'up' ? 'up' : 'down';
}

/** Visible height of an older logo slice. */
export const HERO_SLICE = 64;

/** Tuck between stacked card edges. */
export const HERO_SLICE_OVERLAP = 6;

/** Logo card starts just below the top of the banner. */
const HERO_LOGO_TOP = 30;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function roundPx(value) {
  return Math.round(value) || 0;
}

function blank(stageHeight) {
  return { y: stageHeight, clipTop: 0, clipBottom: 0, hidden: false, z: 1 };
}

/**
 * Keep the current mode until scroll crosses a hero boundary.
 * At that boundary the slider and the deck draw the same frame, so the
 * switch does not jump. Reversing before the boundary scrubs the same model.
 */
export function latchStageMode(mode, delta, previousPos, pos, slides) {
  const wanted = delta > 0 ? 'down' : delta < 0 ? 'up' : mode;
  if (!delta || wanted === mode || !Array.isArray(slides)) return mode;
  const from = Number(previousPos);
  const to = Number(pos);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return wanted;
  for (let index = 0; index < slides.length; index += 1) {
    if (slides[index]?.kind !== 'hero') continue;
    const crossedUp = delta < 0 && from >= index && to < index;
    const crossedDown = delta > 0 && from <= index && to > index;
    if (crossedUp || crossedDown) return wanted;
  }
  return mode;
}

/**
 * @param {{ kind: 'hero' | 'strip' }[]} slides
 * @param {number} local scroll distance into the stage, in px
 * @param {'down' | 'up'} mode
 */
export function heroStageMotion({
  slides,
  local = 0,
  stageHeight = 0,
  mode = 'down',
}) {
  if (!Array.isArray(slides) || slides.length === 0 || stageHeight <= 0) return [];
  const travel = Math.min(Math.max(0, local), Math.max(0, (slides.length - 1) * stageHeight));
  if (mode === 'up') return upDeck(slides, travel, stageHeight);
  return downSlider(slides, travel, stageHeight);
}

function downSlider(slides, travel, stageHeight) {
  const pose = slides.map(() => blank(stageHeight));
  let index = Math.floor(travel / stageHeight);
  let progress = 0;
  if (index >= slides.length - 1) {
    index = slides.length - 1;
    progress = 0;
  } else {
    progress = travel / stageHeight - index;
  }
  const outgoing = roundPx(-progress * stageHeight);
  const incoming = roundPx((1 - progress) * stageHeight);
  slides.forEach((slide, slideIndex) => {
    let y = stageHeight;
    let z = 1;
    if (slideIndex < index) y = -stageHeight;
    else if (slideIndex === index) {
      y = outgoing;
      z = 2;
    } else if (slideIndex === index + 1) {
      y = incoming;
      z = 3;
    }
    pose[slideIndex] = { y, clipTop: 0, clipBottom: 0, hidden: false, z };
  });
  return pose;
}

function logoEdge(stageHeight, visible) {
  if (visible >= stageHeight - 1) return { clipTop: 0, clipBottom: 0 };
  const clipTop = Math.min(HERO_LOGO_TOP, Math.max(0, stageHeight - visible));
  return {
    clipTop: roundPx(clipTop),
    clipBottom: roundPx(Math.max(0, stageHeight - clipTop - visible)),
  };
}

function upDeck(slides, travel, stageHeight) {
  const pose = downSlider(slides, travel, stageHeight);
  const heroIndexes = [];
  slides.forEach((slide, index) => {
    if (slide.kind === 'hero') heroIndexes.push(index);
  });
  if (heroIndexes.length < 2) return pose;

  const pos = travel / stageHeight;
  let featured = heroIndexes[heroIndexes.length - 1];
  for (let cursor = 0; cursor < heroIndexes.length; cursor += 1) {
    if (heroIndexes[cursor] >= pos - 1e-6) {
      featured = heroIndexes[cursor];
      break;
    }
  }
  const previous = heroIndexes.filter((index) => index < featured);
  if (previous.length === 0) return pose;

  const nearest = previous[previous.length - 1];
  const span = featured - nearest;
  const distancePx = Math.max(0, (featured - pos) * stageHeight);
  if (distancePx < 0.5) return pose;

  const opened = span > 0 ? clamp01(distancePx / (span * stageHeight)) : 0;
  const grow = opened <= 0.5 ? 0 : clamp01((opened - 0.5) / 0.5);
  let nearestVisible = distancePx <= HERO_SLICE
    ? distancePx
    : HERO_SLICE + grow * (stageHeight - HERO_SLICE);
  if (opened >= 0.999) nearestVisible = stageHeight;

  const older = previous.slice(0, -1);
  const heights = older.map((index, listIndex) => {
    const order = older.length - 1 - listIndex;
    const start = (order + 1) * HERO_SLICE * 0.45;
    const local = clamp01((distancePx - start) / HERO_SLICE);
    return local * Math.min(HERO_SLICE, stageHeight);
  });

  let olderStack = 0;
  let seen = 0;
  heights.forEach((height) => {
    if (height < 1) return;
    olderStack += height;
    if (seen > 0) olderStack -= HERO_SLICE_OVERLAP;
    seen += 1;
  });
  const tuck = Math.max(0, olderStack - (seen > 0 ? HERO_SLICE_OVERLAP : 0));
  let cursor = -grow * tuck;

  heroIndexes.forEach((index) => {
    pose[index] = blank(stageHeight);
  });

  older.forEach((index, listIndex) => {
    const visible = heights[listIndex];
    if (visible < 1) return;
    const edge = logoEdge(stageHeight, visible);
    pose[index] = {
      y: roundPx(cursor - edge.clipTop),
      clipTop: edge.clipTop,
      clipBottom: edge.clipBottom,
      hidden: false,
      z: 10 + listIndex,
    };
    cursor += visible - HERO_SLICE_OVERLAP;
  });

  const nearestEdge = logoEdge(stageHeight, nearestVisible);
  pose[nearest] = {
    y: roundPx(cursor - nearestEdge.clipTop),
    clipTop: nearestEdge.clipTop,
    clipBottom: nearestEdge.clipBottom,
    hidden: false,
    z: 40,
  };
  cursor += nearestVisible;

  pose[featured] = {
    y: roundPx(cursor),
    clipTop: 0,
    clipBottom: 0,
    hidden: false,
    z: 50,
  };

  slides.forEach((slide, index) => {
    if (slide.kind === 'strip' && index < featured) {
      pose[index] = { ...blank(stageHeight), hidden: true };
    }
  });
  return pose;
}
