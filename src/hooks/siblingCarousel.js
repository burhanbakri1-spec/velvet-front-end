export const SIBLING_DRAG_CLICK_THRESHOLD = 8;

export function isSiblingDragGesture(startX, startY, clientX, clientY, threshold = SIBLING_DRAG_CLICK_THRESHOLD) {
  return Math.hypot(clientX - startX, clientY - startY) > threshold;
}

export function shouldNavigateSibling({ dragged, targetSlug, currentSlug }) {
  return Boolean(targetSlug) && targetSlug !== currentSlug && !dragged;
}
