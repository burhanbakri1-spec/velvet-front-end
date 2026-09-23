/**
 * Sub-brand logos use one shared CSS bounding box (object-fit: contain).
 * Per-brand visual scales are retired — getBrandLogoScale always returns 1
 * so no brand is larger/smaller than another via transform.
 */
export const brandLogoScale = Object.freeze({});

export function getBrandLogoScale(_slug) {
  return 1;
}
