/**
 * Optional per-brand logo visual scale overrides.
 * Values multiply the shared logo viewport (1 = default).
 * Do not edit uploaded assets — only perceived scale.
 */
export const brandLogoScale = {
  // Example: 'baby': 1.08,
};

export function getBrandLogoScale(slug) {
  const value = brandLogoScale[String(slug || '').trim()];
  return typeof value === 'number' && value > 0 ? value : 1;
}
