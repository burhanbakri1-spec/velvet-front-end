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

function roundShift(value) {
  return Math.round(value) || 0;
}

/**
 * Two desktop hero models. Scroll position picks the frame inside the model.
 *
 * Down is a vertical slide. The current hero travels up with the page and the
 * next hero is brought up from below so they move together. A product strip
 * between them stays concealed until that hero has arrived, then it is restored.
 *
 * Up is a full-card reverse. The current hero travels down with the page and
 * only the immediate previous hero comes in from above. Older heroes stay in
 * normal flow until that card has been passed. Nothing is cropped into a slice.
 */
export function heroStageMotion({
  heroes,
  scrollY,
  header,
  viewportHeight,
  mode = 'down',
}) {
  const motion = heroes.map(() => ({ shift: 0, clip: 0, stripHidden: false }));
  if (!Array.isArray(heroes) || heroes.length < 2 || viewportHeight <= 0) return motion;

  const focus = scrollY + header;
  let pair = -1;
  for (let index = 0; index < heroes.length - 1; index += 1) {
    const start = heroes[index].top;
    const end = heroes[index + 1].top;
    if (focus >= start - 0.5 && focus < end - 0.5) {
      pair = index;
      break;
    }
  }
  if (pair < 0) return motion;

  const upper = heroes[pair];
  const lower = heroes[pair + 1];
  const span = lower.top - upper.top;
  if (span <= 0 || upper.height <= 0 || lower.height <= 0) return motion;

  const gap = Math.max(0, span - upper.height);
  const progress = Math.min(1, Math.max(0, (focus - upper.top) / span));

  if (mode === 'up') {
    const shift = roundShift(progress * gap);
    motion[pair] = {
      shift,
      clip: 0,
      stripHidden: gap > 0 && shift !== 0,
    };
    return motion;
  }

  // 0 at both flush frames, so a finished hero sits in normal flow with its
  // strip back in place. In between, the next hero leads the page and climbs
  // over the current one. The lead stays monotonic: it never travels down.
  const lead = Math.sin(Math.PI * progress) * (span / Math.PI) * 0.95;
  const shift = roundShift(-lead);
  motion[pair + 1] = {
    shift,
    clip: 0,
    stripHidden: false,
  };
  motion[pair].stripHidden = gap > 0 && shift !== 0;
  return motion;
}
