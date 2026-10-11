export const BRAND_BANNER_STACK = Object.freeze({
  sliceHeight: 148,
  peek: 144,
  maxHeight: 436,
  scrollThreshold: 36,
});

export function brandBannerStackHeight(count) {
  const { sliceHeight, peek, maxHeight } = BRAND_BANNER_STACK;
  if (count <= 0) return 0;
  return Math.min(maxHeight, sliceHeight + (count - 1) * peek);
}
