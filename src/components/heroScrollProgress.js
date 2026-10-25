/**
 * Desktop hero motion inside a pinned stage.
 * Scroll distance is the only input. Both directions are pure functions of
 * that distance: continuous cover downward, and one continuous deck upward.
 * No layout reads, no easing, no pose swap at a hero index.
 */
export function stepHeroDirection(mode, delta) {
  if (delta > 0) return 'down';
  if (delta < 0) return 'up';
  return mode === 'up' ? 'up' : 'down';
}

/** The old hold consumed 40% of every slide with no visible progress. */
export const HERO_HOLD = 0;

/**
 * How far the outgoing hero drifts up while the next slide covers it.
 * The drift stays well below a full stage so the pair overlaps instead of
 * butting into a scrolling column.
 */
export const HERO_COVER_DRIFT = 0.12;

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
function slideLength(slide, stageHeight) {
  if (slide?.kind === 'strip') {
    const height = Math.round(Number(slide.height));
    if (height > 0) return height;
  }
  return stageHeight;
}

/** Cumulative travel for a downward sequence. Heroes use the stage; strips use their own height. */
export function stageGeometry(slides, stageHeight) {
  const lengths = [];
  const offsets = [];
  let cursor = 0;
  (Array.isArray(slides) ? slides : []).forEach((slide) => {
    offsets.push(cursor);
    const length = slideLength(slide, stageHeight);
    lengths.push(length);
    cursor += length;
  });
  return { lengths, offsets, span: offsets.length ? offsets[offsets.length - 1] : 0 };
}

/**
 * The terminal box follows the active pose. A tall mobile pin closes once the
 * last slide is the lowest content, and the shell becomes the scroll already
 * used plus that box so the next section rises with it. Desktop banners fill
 * the pin, so the box stays on that pose. The leftover there is the shell tail
 * under the final transition; closing the shell onto the pose removes it
 * without clipping the cover or the deck.
 */
export function stageReleaseBox(slides, stageHeight, pinHeight, local, mode = 'down', cachedGeometry, cachedMotion) {
  const geometry = cachedGeometry || stageGeometry(slides, stageHeight);
  const span = geometry.span;
  const last = Array.isArray(slides) && slides.length ? slides[slides.length - 1] : null;
  const measured = Math.round(Number(last?.height));
  const lastLength = last?.kind === 'strip' && measured > 0 ? measured : stageHeight;
  const safeLocal = Math.max(0, Number(local) || 0);
  const canRelease = span > 0 && stageHeight > 0 && pinHeight > 0 && Array.isArray(slides) && slides.length > 1;
  if (!canRelease) {
    return { span, lastLength, atEnd: false, boxHeight: pinHeight, shellHeight: span + pinHeight };
  }
  const atEnd = safeLocal >= span - 0.5;
  if (atEnd) {
    return { span, lastLength, atEnd: true, boxHeight: lastLength, shellHeight: span + lastLength };
  }
  const motion = cachedMotion || heroStageMotion({
    slides,
    local: Math.min(safeLocal, span),
    stageHeight,
    mode: mode === 'up' ? 'up' : 'down',
    geometry,
  });
  let bottom = lastLength;
  const upward = mode === 'up';
  slides.forEach((slide, index) => {
    const pose = motion[index];
    if (!pose || pose.hidden) return;
    // Up leaves untouched slides parked at the blank pose. They are not part
    // of the deck, so they must not keep the pin open.
    if (upward && pose.z <= 1 && pose.y >= stageHeight && !pose.clipTop && !pose.clipBottom) return;
    const height = slide.kind === 'strip' && Math.round(Number(slide.height)) > 0
      ? Math.round(Number(slide.height))
      : stageHeight;
    const slideBottom = pose.y + height - (pose.clipBottom || 0);
    if (pose.y < pinHeight && slideBottom > bottom) bottom = slideBottom;
  });
  const boxHeight = Math.max(lastLength, Math.min(pinHeight, Math.round(bottom)));
  const tallPin = pinHeight > stageHeight + 1;
  const releaseStart = geometry.offsets[slides.length - 2];
  const terminal = safeLocal >= releaseStart - 0.5;
  // Mobile keeps the full pin until the pose itself rises out of it.
  // Desktop keeps that same box, and drops only the shell tail once the
  // final transition has started, so the next section meets the pose.
  const closeShell = (tallPin && boxHeight < pinHeight - 0.5) || (!tallPin && terminal);
  const shellHeight = closeShell
    ? Math.min(span, safeLocal) + boxHeight
    : span + boxHeight;
  return { span, lastLength, atEnd: false, boxHeight, shellHeight };
}

/** Slide index plus progress through that slide. Hero indexes stay the equal-slot positions the deck uses. */
export function stageSlidePos(slides, local, stageHeight, cachedGeometry) {
  if (!Array.isArray(slides) || slides.length === 0 || stageHeight <= 0) return 0;
  const { lengths, offsets, span } = cachedGeometry || stageGeometry(slides, stageHeight);
  const travel = Math.min(Math.max(0, local), span);
  const maxIndex = slides.length - 1;
  let index = maxIndex;
  for (let i = 0; i < maxIndex; i += 1) {
    if (travel < offsets[i + 1]) {
      index = i;
      break;
    }
  }
  const length = lengths[index] || stageHeight;
  const unit = index >= maxIndex || length <= 0 ? 0 : (travel - offsets[index]) / length;
  return index + unit;
}

export function heroStageMotion({
  slides,
  local = 0,
  stageHeight = 0,
  mode = 'down',
  geometry,
}) {
  if (!Array.isArray(slides) || slides.length === 0 || stageHeight <= 0) return [];
  if (mode === 'up') {
    const pos = stageSlidePos(slides, local, stageHeight, geometry);
    const travel = Math.min(Math.max(0, (slides.length - 1) * stageHeight), pos * stageHeight);
    return upDeck(slides, travel, stageHeight);
  }
  return downSequence(slides, local, stageHeight, geometry);
}

function progressOf(unit) {
  return clamp01(unit);
}

function downSequence(slides, local, stageHeight, cachedGeometry) {
  const pose = slides.map(() => blank(stageHeight));
  const { lengths, offsets, span } = cachedGeometry || stageGeometry(slides, stageHeight);
  const travel = Math.min(Math.max(0, local), span);
  const maxIndex = slides.length - 1;
  let index = maxIndex;
  for (let i = 0; i < maxIndex; i += 1) {
    if (travel < offsets[i + 1]) {
      index = i;
      break;
    }
  }
  const length = lengths[index] || stageHeight;
  const unit = index >= maxIndex || length <= 0 ? 0 : (travel - offsets[index]) / length;
  const progress = progressOf(unit);
  const origin = offsets[index];

  // A strip is shorter than the stage. It and the next hero stay one piece
  // and travel that real height, so the seam cannot open into a white gap.
  if (slides[index]?.kind === 'strip') {
    const shift = roundPx(progress * length);
    slides.forEach((slide, slideIndex) => {
      const y = roundPx(offsets[slideIndex] - origin) - shift;
      let z = 1;
      if (slideIndex === index) z = 2;
      else if (slideIndex === index + 1) z = 3;
      pose[slideIndex] = { y, clipTop: 0, clipBottom: 0, hidden: false, z };
    });
    return pose;
  }

  // Cover: one progress drives both heroes. The next slide travels the full
  // stage from below and paints over the current hero. The current hero only
  // drifts, so the two overlap in the same stage instead of forming a column.
  const drift = roundPx(progress * stageHeight * HERO_COVER_DRIFT);
  const nextY = roundPx((1 - progress) * stageHeight);
  const incoming = Math.min(index + 1, maxIndex);
  slides.forEach((slide, slideIndex) => {
    const y = slideIndex <= index
      ? roundPx(offsets[slideIndex] - origin) - drift
      : nextY + roundPx(offsets[slideIndex] - offsets[incoming]);
    let z = 1;
    if (slideIndex === index) z = 2;
    else if (slideIndex === incoming) z = 4;
    else if (slideIndex > incoming) z = 3;
    pose[slideIndex] = { y, clipTop: 0, clipBottom: 0, hidden: false, z };
  });
  return pose;
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
  const t = clamp01(unit);
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
