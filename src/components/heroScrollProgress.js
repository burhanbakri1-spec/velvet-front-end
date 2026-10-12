/** Visible height of each older card before the next one starts to appear. */
export const HERO_DECK_PEEK = 100;

/**
 * Scroll direction for the two desktop hero models.
 * Any downward delta leaves the deck immediately. Any upward delta enters it.
 * A zero delta keeps the current model, so a paused wheel does not change the frame.
 */
export function stepHeroDirection(mode, delta) {
  if (delta > 0) return 'down';
  if (delta < 0) return 'up';
  return mode === 'up' ? 'up' : 'down';
}

function roundShift(value) {
  return Math.round(value) || 0;
}

/**
 * Desktop hero motion.
 *
 * Down is not handled here: the page stays in normal flow, so the current
 * hero travels up, the next hero enters from below, and each product strip
 * keeps its place. No overlap, clip, or leftover transform.
 *
 * Up is a deck reveal driven by `distance` (pixels scrolled up since the
 * direction changed). The nearest previous hero grows first. Each further
 * peek brings the next older hero in above it. The current hero moves down
 * with that same distance. Strips between those layers are concealed.
 */
export function heroStageMotion({
  heroes,
  scrollY,
  header,
  viewportHeight,
  mode = 'down',
  distance = 0,
  anchorScrollY = scrollY,
}) {
  const motion = heroes.map(() => ({ shift: 0, clip: 0, stripHidden: false }));
  if (mode !== 'up' || distance <= 0 || viewportHeight <= 0) return motion;
  if (!Array.isArray(heroes) || heroes.length < 2) return motion;

  const focus = anchorScrollY + header;
  let current = -1;
  for (let index = 0; index < heroes.length; index += 1) {
    if (heroes[index].height > 0 && heroes[index].top <= focus + 0.5) current = index;
  }
  if (current <= 0) return motion;

  const reveal = heroes.map(() => 0);
  let budget = distance;
  for (let index = current - 1; index >= 0 && budget > 0; index -= 1) {
    const amount = Math.min(budget, HERO_DECK_PEEK);
    reveal[index] = amount;
    budget -= amount;
  }
  if (budget > 0) {
    const lead = current - 1;
    const room = Math.max(0, heroes[lead].height - reveal[lead]);
    reveal[lead] += Math.min(budget, room);
  }
  const total = reveal.reduce((sum, value) => sum + value, 0);

  for (let index = 0; index < current; index += 1) {
    const natural = heroes[index].top - scrollY;
    motion[index] = {
      shift: roundShift(header - heroes[index].height - natural),
      clip: 0,
      stripHidden: true,
    };
  }

  let cursor = header;
  for (let index = 0; index < current; index += 1) {
    if (reveal[index] <= 0) continue;
    const natural = heroes[index].top - scrollY;
    motion[index] = {
      shift: roundShift(cursor - natural),
      clip: 0,
      stripHidden: true,
      z: 30 + index,
    };
    cursor += reveal[index];
  }

  const currentNatural = heroes[current].top - scrollY;
  const meetShift = (header + total) - currentNatural;
  motion[current] = {
    shift: roundShift(Math.max(0, Math.min(meetShift, total))),
    clip: 0,
    stripHidden: false,
  };
  return motion;
}
