/**
 * Desktop hero motion inside a pinned stage.
 * Scroll distance is the only input. Both directions are pure functions of
 * that distance: hold-then-slide downward, and one continuous deck upward.
 * No layout reads, no easing, no pose swap at a hero index.
 */
export function stepHeroDirection(mode, delta) {
  if (delta > 0) return 'down';
  if (delta < 0) return 'up';
  return mode === 'up' ? 'up' : 'down';
}

/** Fraction of each slide's scroll that holds the slide still. */
export const HERO_HOLD = 0.4;

/** Visible height of an older logo slice. */
export const HERO_SLICE = 64;

/** Tuck between stacked card edges. */
export const HERO_SLICE_OVERLAP = 6;

/** Logo card starts just below the top of the banner. */
const HERO_LOGO_TOP = 30;

const STEP = HERO_SLICE - HERO_SLICE_OVERLAP;

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
 * Keep the current mode until scroll crosses a hero index.
 * Both modes draw the same full-bleed frame on that index, so the
 * handoff does not move. Reversing before the index scrubs the same model.
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
  const maxIndex = slides.length - 1;
  let index = Math.floor(travel / stageHeight);
  let unit = 0;
  if (index >= maxIndex) {
    index = maxIndex;
    unit = 0;
  } else {
    unit = travel / stageHeight - index;
  }
  const t = unit <= HERO_HOLD ? 0 : (unit - HERO_HOLD) / (1 - HERO_HOLD);
  const outgoing = roundPx(-t * stageHeight);
  const incoming = outgoing + stageHeight;
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
  if (visible >= stageHeight - 0.5) return { clipTop: 0, clipBottom: 0 };
  const clipTop = Math.min(HERO_LOGO_TOP, Math.max(0, stageHeight - visible));
  return {
    clipTop: roundPx(clipTop),
    clipBottom: roundPx(Math.max(0, stageHeight - clipTop - visible)),
  };
}

function heroIndexesOf(slides) {
  const heroes = [];
  slides.forEach((slide, index) => {
    if (slide.kind === 'hero') heroes.push(index);
  });
  return heroes;
}

/**
 * One segment between two heroes. g=0 is the upper hero full-bleed.
 * g=1 is the lower hero full-bleed. The same numbers are the neighboring
 * segment's opposite end, so the stack never rebuilds.
 */
function upDeck(slides, travel, stageHeight) {
  const heroes = heroIndexesOf(slides);
  if (heroes.length < 2) return downSlider(slides, travel, stageHeight);
  const pos = travel / stageHeight;
  if (pos <= heroes[0] + 1e-6 || pos >= heroes[heroes.length - 1] - 1e-6) {
    return downSlider(slides, travel, stageHeight);
  }

  let upperK = heroes.length - 1;
  for (let k = 1; k < heroes.length; k += 1) {
    if (pos <= heroes[k]) {
      upperK = k;
      break;
    }
  }
  const upper = heroes[upperK];
  const lower = heroes[upperK - 1];
  const span = upper - lower;
  const distPx = (upper - pos) * stageHeight;
  const older = heroes.slice(0, upperK - 1);
  const nearestVisible = Math.min(stageHeight, distPx / span);
  const olderVisible = Math.min(HERO_SLICE, nearestVisible);
  const grow = clamp01((nearestVisible - HERO_SLICE) / (stageHeight - HERO_SLICE));
  const shift = -older.length * STEP * grow;
  const lift = HERO_SLICE_OVERLAP * grow;

  const pose = slides.map(() => blank(stageHeight));
  let cursor = 0;
  older.forEach((index, listIndex) => {
    const edge = olderVisible >= 1
      ? logoEdge(stageHeight, olderVisible)
      : { clipTop: 0, clipBottom: stageHeight };
    pose[index] = {
      y: roundPx(cursor - lift + shift - edge.clipTop),
      clipTop: edge.clipTop,
      clipBottom: edge.clipBottom,
      hidden: false,
      z: 10 + listIndex,
    };
    cursor += Math.max(0, olderVisible - Math.min(HERO_SLICE_OVERLAP, olderVisible));
  });

  const nearestTop = cursor + shift;
  const edge = nearestVisible >= 1
    ? logoEdge(stageHeight, nearestVisible)
    : { clipTop: 0, clipBottom: stageHeight };
  const tuck = Math.min(nearestVisible, HERO_SLICE_OVERLAP * (1 - grow));
  pose[lower] = {
    y: roundPx(nearestTop - edge.clipTop),
    clipTop: edge.clipTop,
    clipBottom: edge.clipBottom,
    hidden: false,
    z: 40,
  };
  pose[upper] = {
    y: roundPx(nearestTop + nearestVisible - tuck),
    clipTop: 0,
    clipBottom: 0,
    hidden: false,
    z: 30,
  };

  if (nearestVisible >= 1) {
    slides.forEach((slide, index) => {
      if (slide.kind === 'strip' && index < upper) {
        pose[index] = { ...blank(stageHeight), hidden: true };
      }
    });
  }
  return pose;
}
