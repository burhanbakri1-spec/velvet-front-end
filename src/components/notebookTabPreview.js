// The opt-in trial uses the existing motion poses as read-only geometry.
export function notebookTabLifts(slides, motion, pinHeight, rise, pocket) {
  if (!rise || !pocket) return [];
  const rows = [];
  slides.forEach((slide, index) => {
    const pose = motion[index];
    if (slide.kind !== 'hero' || !pose || pose.hidden || pose.y < 0 || pose.y >= pinHeight || pose.clipTop) return;
    const visibleBottom = pose.y + slide.notebookHeight - (pose.clipBottom || 0);
    if (visibleBottom > pose.y) {
      rows.push({ index, y: pose.y, z: pose.z, visibleBottom, logo: slide.notebookLogo });
    }
  });
  rows.sort((a, b) => a.y - b.y || a.index - b.index);
  const lifts = [];
  const availableTop = -pocket;
  let nextTabTop = Infinity;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const { index, y } = rows[i];
    let bottom = Math.min(y, nextTabTop);
    for (let previous = i - 1; previous >= 0; previous -= 1) {
      const row = rows[previous];
      if (!row.logo) continue;
      const logoTop = row.y + row.logo.top;
      // Existing card overlap can already mask the lower part of a logo.
      // Keep the tab clear of the portion that still paints in this pose.
      let logoBottom = Math.min(row.visibleBottom, row.y + row.logo.bottom);
      for (let above = previous + 1; above < rows.length && rows[above].y < logoBottom; above += 1) {
        const card = rows[above];
        if (card.z >= row.z && card.visibleBottom > logoTop) logoBottom = card.y;
      }
      if (logoBottom > logoTop && bottom > logoTop && bottom - rise < logoBottom) bottom = logoTop - 1;
    }
    const lift = Math.floor(y - Math.max(availableTop + rise, bottom));
    lifts[index] = Math.max(0, lift);
    nextTabTop = y - lifts[index] - rise;
  }
  return lifts;
}

/** Retain only the measured tab pocket while the sticky containing block closes. */
export function notebookReleaseAllowance(rawLocal, span, shellHeight, boxHeight, pocket) {
  if (rawLocal < 0 || pocket <= 0) return 0;
  const required = Math.min(rawLocal, span) + boxHeight + pocket - shellHeight;
  const pastLastBanner = Math.max(0, rawLocal - span);
  return Math.max(0, Math.min(pocket, required) - pastLastBanner);
}
