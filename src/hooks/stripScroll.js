export const STRIP_GROUPS = 8;

export function clampStripScrollPosition(position, trackWidth, viewportWidth, step) {
  if (step <= 0 || viewportWidth <= 0) return position;
  const band = trackWidth - viewportWidth - step;
  if (band <= 0) return 0;
  const tolerance = step * 1e-6;
  let next = position;
  if (next > band + tolerance) {
    next = position - Math.ceil((position - band) / step) * step;
  } else if (next < -band - tolerance) {
    next = position + Math.ceil((-band - position) / step) * step;
  }
  if (next > band + tolerance || next < -band - tolerance) return 0;
  return next;
}

export function normalizeStripScroll(event) {
  const viewport = event.currentTarget;
  const track = viewport.firstElementChild;
  const group = track?.firstElementChild;
  if (!group) return;
  const next = clampStripScrollPosition(
    viewport.scrollLeft,
    track.offsetWidth,
    viewport.clientWidth,
    group.offsetWidth,
  );
  if (next !== viewport.scrollLeft) viewport.scrollLeft = next;
}
