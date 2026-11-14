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

/** Native scrollY rounds to whole pixels while measured hero offsets can be fractional. */
export function latchHomeDeckMode(mode, delta, previousLocal, local, slides, geometry) {
  const wanted = stepHeroDirection(mode, delta);
  if (!delta || wanted === mode || !geometry) return mode;
  let firstHeroIndex = -1;
  for (let index = 0; index < slides.length; index += 1) {
    if (slides[index]?.kind === 'hero') { firstHeroIndex = index; break; }
  }
  for (let index = 0; index < slides.length; index += 1) {
    if (slides[index]?.kind !== 'hero') continue;
    const boundary = geometry.offsets[index];
    if (delta < 0 && index === firstHeroIndex && previousLocal <= boundary + 1 && local <= boundary + 1) return 'up';
    if (delta < 0 && index === firstHeroIndex && previousLocal > boundary + 1 && local <= boundary + 1) return 'up';
    if (delta < 0 && previousLocal >= boundary - 1 && local < boundary - 1) return 'up';
    if (delta > 0 && previousLocal <= boundary + 1 && local > boundary + 1) return 'down';
  }
  return mode;
}

/** Capture the first geometric hero boundary crossed while returning upward. */
export function homeReverseEntry(slides, previousLocal, local, stageHeight, pinHeight, cachedGeometry) {
  if (!Array.isArray(slides) || local >= previousLocal || stageHeight <= 0 || pinHeight <= 0) return null;
  const geometry = cachedGeometry || stageGeometry(slides, stageHeight);
  const heroes = heroIndexesOf(slides);
  const stackRoom = Math.max(0, pinHeight - stageHeight);
  const step = heroes.length > 1
    ? Math.min(HERO_SLICE - HERO_SLICE_OVERLAP, stackRoom / (heroes.length - 1))
    : 0;

  // If a wheel/touch delta crosses several slots, the highest crossed hero is
  // the point at which the reverse stack first takes ownership.
  for (let ordinal = heroes.length - 1; ordinal > 0; ordinal -= 1) {
    const slideIndex = heroes[ordinal];
    const boundary = geometry.offsets[slideIndex];
    if (previousLocal < boundary - 1 || local > boundary + 1) continue;
    const stackDistance = ordinal * step;
    return {
      heroIndex: slides[slideIndex].heroIndex ?? ordinal,
      startLocal: boundary,
      lockLocal: boundary - stackDistance,
      stackDistance,
    };
  }
  return null;
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
    const height = Number(pose.height) > 0
      ? Number(pose.height)
      : slide.kind === 'strip' && Math.round(Number(slide.height)) > 0
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

/** Restore the mobile UP page box over scroll distance after the terminal release. */
export function restoreMobileUpLayout(release, anchor, local, pinHeight) {
  if (!release || !anchor || pinHeight <= 0) return release;
  const boxDistance = Math.max(0, pinHeight - anchor.boxHeight);
  const shellDistance = Math.max(0, release.span + pinHeight - anchor.shellHeight);
  const restoreDistance = Math.max(1, boxDistance, shellDistance);
  const progress = clamp01((anchor.local - local) / restoreDistance);
  return {
    ...release,
    boxHeight: roundPx(anchor.boxHeight + (pinHeight - anchor.boxHeight) * progress),
    shellHeight: roundPx(anchor.shellHeight + (release.span + pinHeight - anchor.shellHeight) * progress),
  };
}

/**
 * Capture the displacement needed to make the first mobile UP-deck frame
 * continue from the same active banner pose as the DOWN frame at that scroll
 * position. The offset expires at the preceding full-bleed hero boundary.
 */
export function mobileUpHandoff(slides, downPose, upPose, local, stageHeight, geometry) {
  if (!Array.isArray(slides) || !Array.isArray(downPose) || !Array.isArray(upPose) || !geometry) return null;
  const active = slides.reduce((best, slide, index) => {
    if (slide.kind !== 'hero') return best;
    const pose = downPose[index];
    if (!pose || pose.hidden || pose.y >= stageHeight || pose.y + stageHeight <= 0) return best;
    const candidateUp = upPose[index];
    if (!candidateUp || candidateUp.hidden || candidateUp.z <= 1) return best;
    if (!best || pose.z > downPose[best.index].z) return { index };
    return best;
  }, null);
  if (!active) return null;
  const from = downPose[active.index];
  const to = upPose[active.index];
  let endLocal = 0;
  slides.forEach((slide, index) => {
    if (slide.kind === 'hero' && index < active.index && geometry.offsets[index] < local) {
      endLocal = geometry.offsets[index];
    }
  });
  if (local <= endLocal) return null;
  return { index: active.index, offset: from.y - to.y, startLocal: local, endLocal };
}

/** Apply a scroll-linked, endpoint-preserving offset during the mobile UP handoff. */
export function applyMobileUpHandoff(motion, slides, handoff, local) {
  if (!handoff || !Array.isArray(motion) || !Array.isArray(slides)) return motion;
  const distance = handoff.startLocal - handoff.endLocal;
  if (distance <= 0) return motion;
  const progress = clamp01((handoff.startLocal - local) / distance);
  const eased = progress * progress * (3 - 2 * progress);
  const offset = roundPx(handoff.offset * (1 - eased));
  if (!offset) return motion;
  return motion.map((pose, index) => (
    slides[index]?.kind === 'hero' && pose && pose.z > 1 && !pose.hidden
      ? { ...pose, y: pose.y + offset }
      : pose
  ));
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
  upDeckDepth,
}) {
  if (!Array.isArray(slides) || slides.length === 0 || stageHeight <= 0) return [];
  if (mode === 'up') {
    const pos = stageSlidePos(slides, local, stageHeight, geometry);
    const travel = Math.min(Math.max(0, (slides.length - 1) * stageHeight), pos * stageHeight);
    return upDeck(slides, travel, stageHeight, upDeckDepth);
  }
  return downSequence(slides, local, stageHeight, geometry);
}

/**
 * Home's upward deck uses measured banner/product distances. Every banner
 * keeps the measured card height; reverse motion changes only card position,
 * clipping and stacking. Product strips occupy their own lower lane.
 */
export function homeReverseMotion(slides, local, stageHeight, pinHeight, cachedGeometry, entry = null) {
  const geometry = cachedGeometry || stageGeometry(slides, stageHeight);
  const heroes = heroIndexesOf(slides);
  const travel = Math.min(Math.max(0, local), geometry.span);
  let current = -1;
  for (let index = 1; index < heroes.length; index += 1) {
    const boundary = geometry.offsets[heroes[index]];
    if (Math.abs(travel - boundary) <= 1 || travel < boundary) {
      current = index;
      break;
    }
  }
  if (current < 0 && travel <= geometry.offsets[heroes[heroes.length - 1]]) current = heroes.length - 1;
  if (current < 0 || travel <= geometry.offsets[heroes[0]]) {
    const firstHero = heroes[0];
    const motion = slides.map((slide) => ({ y: pinHeight, clipTop: 0, clipBottom: 0, hidden: true, z: 1 }));
    motion[firstHero] = { y: 0, clipTop: 0, clipBottom: 0, hidden: false, z: 50 };
    const firstStrip = slides.findIndex((slide) => slide.kind === 'strip' && slide.heroIndex === slides[firstHero].heroIndex);
    const firstStripHeight = firstStrip >= 0 ? slideLength(slides[firstStrip], stageHeight) : 0;
    if (firstStrip >= 0) {
      motion[firstStrip] = { y: stageHeight, clipTop: 0, clipBottom: 0, hidden: false, z: 5 };
    }
    return {
      motion,
      activeHero: slides[firstHero].heroIndex,
      firstBanner: true,
      progress: 1,
      phase: 'locked',
      // The first banner has no reverse card behind it. Let the real banner
      // and its real product strip define the scene edge so the pinned stage
      // cannot expose an empty tail before the preceding document section.
      sceneHeight: stageHeight + firstStripHeight,
    };
  }

  const previousIndex = heroes[current - 1];
  const currentIndex = heroes[current];
  const start = geometry.offsets[previousIndex];
  const end = geometry.offsets[currentIndex];
  const currentOrdinal = heroes.indexOf(currentIndex);
  const stackRoom = Math.max(0, pinHeight - stageHeight);
  const step = heroes.length > 1
    ? Math.min(HERO_SLICE - HERO_SLICE_OVERLAP, stackRoom / (heroes.length - 1))
    : 0;
  const stackHeight = roundPx(currentOrdinal * step);
  const entersHere = entry?.heroIndex === slides[currentIndex].heroIndex && entry.stackDistance > 0;
  const entranceStart = entersHere ? entry.startLocal : end;
  const lockLocal = entersHere ? entry.lockLocal : end;
  const inEntrance = entersHere && travel <= entranceStart + 1 && travel > lockLocal + 0.5;
  const entranceProgress = inEntrance
    ? clamp01((entranceStart - travel) / Math.max(1, entranceStart - lockLocal))
    : 1;
  const groupShift = inEntrance ? roundPx(-stackHeight * (1 - entranceProgress)) : 0;
  const progressStart = entersHere ? lockLocal : end;
  const progress = inEntrance
    ? 0
    : clamp01((progressStart - travel) / Math.max(1, progressStart - start));
  const motion = slides.map((slide) => ({
    y: pinHeight,
    clipTop: 0,
    clipBottom: 0,
    hidden: true,
    z: 1,
  }));

  // Cards keep the measured stageHeight. The reverse pose changes only their
  // position and clip. A fixed per-brand step keeps a compact stack at every
  // deck depth; the immediate previous card stays anchored as it is revealed.
  // Native wheel/touch deltas can stop a few device pixels short of a measured
  // boundary. Settle the matching lower strip within that same small physical
  // band so the clipped scene cannot finish with an empty lower lane.
  const settledAtPrevious = !inEntrance && travel <= start + 0.5;
  const slice = Math.min(HERO_SLICE, stageHeight);
  const mainY = stackHeight;
  const previousY = roundPx((currentOrdinal - 1) * step);
  // The outgoing banner only needs to clear the stationary previous banner.
  // Sending it to the bottom of the taller pin exposes unused space below that
  // fixed-size card, creating a white band inside the stage.
  const exitY = previousY + stageHeight;
  const currentY = inEntrance
    ? roundPx(mainY + groupShift)
    : roundPx(mainY + progress * Math.max(0, exitY - mainY));
  heroes.slice(0, currentOrdinal).forEach((index, stackIndex) => {
    const isPrevious = index === previousIndex;
    const slotY = roundPx(stackIndex * step + groupShift);
    const visibleHeight = isPrevious && !inEntrance
      ? Math.max(slice, Math.min(stageHeight, currentY - slotY + HERO_SLICE_OVERLAP))
      : slice;
    motion[index] = {
      y: slotY,
      clipTop: 0,
      clipBottom: roundPx(Math.max(0, stageHeight - visibleHeight)),
      hidden: false,
      z: 10 + stackIndex,
    };
  });

  motion[previousIndex].z = 40;
  motion[currentIndex] = {
    y: currentY,
    clipTop: 0,
    clipBottom: settledAtPrevious ? stageHeight : 0,
    hidden: false,
    z: 50,
  };

  // The active brand's product lane follows its own banner during the handoff.
  // Once the previous banner is fully revealed, restore that brand's strip.
  const stripHeroIndex = settledAtPrevious ? previousIndex : currentIndex;
  const stripIndex = slides.findIndex((slide) => slide.kind === 'strip' && slide.heroIndex === slides[stripHeroIndex].heroIndex);
  if (stripIndex >= 0) {
    motion[stripIndex] = {
      y: (settledAtPrevious ? motion[previousIndex].y : currentY) + stageHeight,
      clipTop: 0,
      clipBottom: 0,
      hidden: false,
      z: 5,
    };
  }

  return {
    motion,
    activeHero: settledAtPrevious ? slides[previousIndex].heroIndex : slides[currentIndex].heroIndex,
    previousHero: slides[previousIndex].heroIndex,
    currentHero: slides[currentIndex].heroIndex,
    progress,
    phase: inEntrance ? 'stack-entrance' : 'banner',
    phaseProgress: inEntrance ? entranceProgress : progress,
    entryHero: entersHere ? entry.heroIndex : null,
    stackStep: step,
    stackHeight: mainY,
    exitY,
    sceneHeight: pinHeight,
  };
}

/** Pick the banner occupying the largest visible part of the stage. */
export function activeHeroIndex(slides, motion, stageHeight) {
  let winner = null;
  let largestVisible = 0;
  let highestLayer = -Infinity;
  (Array.isArray(slides) ? slides : []).forEach((slide, index) => {
    if (slide?.kind !== 'hero') return;
    const pose = motion?.[index];
    if (!pose || pose.hidden) return;
    const top = pose.y + (pose.clipTop || 0);
    const slideHeight = Number(pose.height) > 0 ? Number(pose.height) : stageHeight;
    const bottom = pose.y + slideHeight - (pose.clipBottom || 0);
    const visible = Math.max(0, Math.min(stageHeight, bottom) - Math.max(0, top));
    const layer = Number(pose.z) || 0;
    if (visible > largestVisible + 0.5 || (visible > 0 && Math.abs(visible - largestVisible) <= 0.5 && layer > highestLayer)) {
      winner = slide.heroIndex ?? index;
      largestVisible = visible;
      highestLayer = layer;
    }
  });
  return winner ?? 0;
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
function upDeck(slides, travel, stageHeight, depth = Infinity) {
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
  // The nearest and incoming heroes retain the original segment. Historical
  // slices roll out at a full-bleed hero boundary, where they are offscreen.
  const olderCount = Number.isFinite(depth) ? Math.max(0, Math.floor(depth) - 2) : heroes.length;
  const firstOlder = Math.max(0, upperK - 1 - olderCount);
  const older = heroes.slice(firstOlder, upperK - 1);
  const nearestVisible = Math.min(stageHeight, distPx / span);
  // In the bounded mobile deck, the available reveal distance belongs to the
  // whole historical stack. Giving every slice the full distance multiplies
  // the incoming banner's travel by the number of visible slices at the first
  // DOWN→UP handoff. Distribute that distance across the window; at the full
  // stage endpoint each slice still reaches its original HERO_SLICE size.
  const olderVisible = Math.min(
    HERO_SLICE,
    Number.isFinite(depth) && older.length > 0 ? nearestVisible / older.length : nearestVisible,
  );
  const grow = clamp01((nearestVisible - HERO_SLICE) / (stageHeight - HERO_SLICE));
  const shift = -older.length * STEP * grow;
  const lift = HERO_SLICE_OVERLAP * grow;

  const pose = slides.map(() => blank(stageHeight));
  heroes.slice(0, firstOlder).forEach((index) => {
    pose[index] = { ...blank(stageHeight), y: -stageHeight };
  });
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
    // A bounded mobile stack can briefly be taller than the banner. Keep its
    // incoming banner at its endpoint instead of pushing it past and back.
    y: roundPx(Number.isFinite(depth)
      ? Math.min(stageHeight, nearestTop + nearestVisible - tuck)
      : nearestTop + nearestVisible - tuck),
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
