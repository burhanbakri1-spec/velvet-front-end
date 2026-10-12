/**
 * One reversible desktop hero transition. Scroll position alone picks the frame,
 * so upward and downward travel are the same motion played in opposite directions.
 *
 * The active pair is the two heroes whose document span contains the header.
 * The exact flush frame belongs to the pair that just arrived, which seats the
 * hero above behind the flush banner. The next upward pixel reveals it. The next
 * downward pixel starts the following pair and brings the hero below in from the fold.
 *
 * Shared progress:
 *   0 = upper hero flush with the header
 *   1 = lower hero flush with the header
 * Both visual tops move by the same amount. A banner taller than the viewport used
 * to travel alone until its top reached the header; that extra distance is absorbed
 * by the shift, so the neighbor enters on the first pixel and the last frame matches
 * normal flow. The product strip between the pair is concealed only while that
 * progress is between the two flush frames.
 */
export function heroStageMotion({ heroes, scrollY, header, viewportHeight }) {
  const motion = heroes.map(() => ({ shift: 0, clip: 0, stripHidden: false }));
  if (!Array.isArray(heroes) || heroes.length < 2 || viewportHeight <= 0) return motion;

  const visible = viewportHeight - header;
  if (visible <= 0) return motion;

  const focus = scrollY + header;
  let pair = -1;
  for (let index = 0; index < heroes.length - 1; index += 1) {
    const start = heroes[index].top;
    const end = heroes[index + 1].top;
    if (focus >= start - 0.5 && focus <= end + 0.5) {
      pair = index;
      break;
    }
  }
  if (pair < 0) return motion;

  const upper = heroes[pair];
  const lower = heroes[pair + 1];
  const span = lower.top - upper.top;
  if (span <= visible + 0.5 || upper.height <= 0 || lower.height <= 0) return motion;

  const progress = Math.min(1, Math.max(0, (focus - upper.top) / span));
  const gap = Math.max(0, lower.top - (upper.top + upper.height));
  const roundShift = (value) => Math.round(value) || 0;
  motion[pair] = {
    shift: roundShift(progress * (span - visible)),
    clip: 0,
    stripHidden: gap > 0 && progress > 0.001 && progress < 0.999,
  };
  motion[pair + 1] = {
    shift: roundShift((1 - progress) * (visible - span)),
    clip: 0,
    stripHidden: false,
    cover: true,
  };
  return motion;
}
