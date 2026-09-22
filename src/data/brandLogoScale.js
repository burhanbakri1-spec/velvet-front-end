/**
 * Optional per-brand logo visual scale overrides.
 * Values multiply the shared logo viewport (1 = default).
 * Do not edit uploaded assets — only perceived scale.
 * Values normalize perceived wordmark size across brands vs BABY (scale 1).
 * Range: ~0.85–1.2; preserves aspect ratio; no crop/stretch.
 */
export const brandLogoScale = {
  baby: 1.0,
  kids: 1.02,
  play: 0.94,
  build: 1.12,
  learn: 0.88,
  create: 1.07,
  games: 0.89,
  move: 1.10,
  collect: 0.93,
  plush: 1.15,
  books: 0.86,
  muslim: 1.0,
};

export function getBrandLogoScale(slug) {
  const value = brandLogoScale[String(slug || '').trim()];
  return typeof value === 'number' && value > 0 ? value : 1;
}
