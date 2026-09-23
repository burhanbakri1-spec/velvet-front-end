/**
 * Customer reviews API for the VELVET storefront.
 *
 * Verified staging contract:
 * - GET  /api/reviews returns approved-only reviews (pending are not visible).
 * - POST /api/reviews (Bearer):
 *     { scope: 'store', rating, comment } → store review (pending until approved)
 *     { scope: 'product', productId, rating, comment } → product review
 *
 * MISSING API CONTRACT (verified on staging 2026-09-23):
 * There is NO customer-owned "my reviews" list endpoint.
 * Tried and unavailable: GET /api/reviews/my-reviews, /api/reviews/mine,
 * /api/my-reviews, /api/customer/reviews (404). Query params mine/owned/customer=me
 * on GET /api/reviews do not return the customer's pending submissions.
 *
 * Therefore:
 * - Storefront surfaces only approved reviews from GET /api/reviews.
 * - Local storage holds TEMPORARY optimistic pending submissions only — never
 *   treated as persisted server history.
 */

import { parseJsonResponse, readErrorDetail, storefrontFetch } from './apiClient.js';

const OPTIMISTIC_PENDING_KEY = 'velvet-optimistic-pending-reviews-v1';
/** @deprecated legacy key — migrated once into OPTIMISTIC_PENDING_KEY */
const LEGACY_SUBMITTED_KEY = 'velvet-submitted-reviews-v1';

/** Keep only approved reviews (defensive — the API already filters). */
export function filterApprovedReviews(reviews) {
  return (Array.isArray(reviews) ? reviews : []).filter((review) => {
    if (!review || typeof review !== 'object') return false;
    if (review.isApproved === true) return true;
    if (review.status == null && review.approved == null) return true;
    if (review.approved === true) return true;
    return String(review.status || '').toLowerCase() === 'approved';
  });
}

function normalizeReviewList(payload) {
  const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.reviews) ? payload.reviews : []);
  return filterApprovedReviews(list);
}

export async function getStoreReviews({ token } = {}) {
  const response = await storefrontFetch('/api/reviews?scope=store', { token });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return { ok: false, status: response.status, message: detail || 'Unable to load reviews.' };
  }
  const payload = await parseJsonResponse(response);
  return { ok: true, reviews: normalizeReviewList(payload) };
}

export async function getProductReviews(productId, { token } = {}) {
  const response = await storefrontFetch(
    `/api/reviews?scope=product&productId=${encodeURIComponent(productId)}`,
    { token },
  );
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return { ok: false, status: response.status, message: detail || 'Unable to load reviews.' };
  }
  const payload = await parseJsonResponse(response);
  return { ok: true, reviews: normalizeReviewList(payload) };
}

/** Submit a review. Returns the raw response (pending until approved). */
export async function submitReview({ scope, productId, rating, comment }, token) {
  const body = { scope, rating: Number(rating), comment: String(comment || '').trim() };
  if (scope === 'product' && productId) body.productId = String(productId);
  const response = await storefrontFetch('/api/reviews', { method: 'POST', body, token });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return { ok: false, status: response.status, message: detail || 'Unable to submit your review.' };
  }
  const payload = await parseJsonResponse(response);
  return { ok: true, review: payload?.review || payload || null };
}

function readOptimisticPending() {
  try {
    if (typeof window === 'undefined') return [];
    const primary = JSON.parse(window.localStorage.getItem(OPTIMISTIC_PENDING_KEY) || '[]');
    if (Array.isArray(primary) && primary.length) return primary;
    const legacy = JSON.parse(window.localStorage.getItem(LEGACY_SUBMITTED_KEY) || '[]');
    return Array.isArray(legacy) ? legacy : [];
  } catch {
    return [];
  }
}

function writeOptimisticPending(reviews) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(OPTIMISTIC_PENDING_KEY, JSON.stringify(reviews));
  } catch {
    /* Storage may be unavailable. */
  }
}

/**
 * Temporary optimistic UI only — NOT server history.
 * Used until a real GET customer my-reviews endpoint exists.
 */
export function persistOptimisticPendingReview(review, customer) {
  const customerId = String(customer?.id || customer?.email || '');
  if (!customerId || !review) return;
  const entry = {
    ...review,
    customerId,
    submittedAt: review.submittedAt || new Date().toISOString(),
    status: 'pending',
    _optimisticPending: true,
  };
  const next = [
    entry,
    ...readOptimisticPending().filter((item) => (
      item.customerId !== customerId || String(item.comment || '') !== String(entry.comment || '')
    )),
  ];
  writeOptimisticPending(next.slice(0, 100));
}

/** @deprecated alias — prefer persistOptimisticPendingReview */
export function persistSubmittedReview(review, customer) {
  return persistOptimisticPendingReview(review, customer);
}

/** Local optimistic pending reviews for this customer (not server history). */
export function getOptimisticPendingReviews(customer) {
  const customerId = String(customer?.id || customer?.email || '');
  if (!customerId) return [];
  return readOptimisticPending()
    .filter((item) => item.customerId === customerId)
    .map((item) => ({ ...item, _optimisticPending: true, status: item.status || 'pending' }));
}

/** @deprecated alias — prefer getOptimisticPendingReviews */
export function getSubmittedReviews(customer) {
  return getOptimisticPendingReviews(customer);
}

/**
 * Approved public reviews that can be attributed to this customer.
 * Does not invent history — only filters the public approved list.
 */
export function filterApprovedReviewsForCustomer(approved, customer) {
  const customerId = String(customer?.id || '');
  const customerEmail = String(customer?.email || '').toLowerCase();
  return filterApprovedReviews(approved).filter((review) => {
    const reviewId = String(review?.userId || review?.customerUserId || review?.customerId || '');
    const reviewEmail = String(review?.email || '').toLowerCase();
    return (customerId && reviewId && reviewId === customerId)
      || (customerEmail && reviewEmail && reviewEmail === customerEmail);
  });
}

/**
 * Load public approved reviews and return those attributable to the customer.
 * Pending local submissions are NOT merged here as server history.
 */
export async function listApprovedReviewsForCustomer(customer, { token } = {}) {
  const response = await storefrontFetch('/api/reviews', { token });
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    return { ok: false, status: response.status, message: detail || 'Unable to load reviews.' };
  }
  const payload = await parseJsonResponse(response);
  const all = normalizeReviewList(payload);
  return { ok: true, reviews: filterApprovedReviewsForCustomer(all, customer) };
}

/**
 * @deprecated Prefer getOptimisticPendingReviews + filterApprovedReviewsForCustomer.
 * Kept for compatibility; documents that local items are optimistic only.
 */
export function mergeUserReviews(_submitted, approved, customer) {
  const pending = getOptimisticPendingReviews(customer);
  const publicMine = filterApprovedReviewsForCustomer(approved, customer);
  const merged = [...pending];
  for (const review of publicMine) {
    const duplicate = merged.some((item) => (
      item.id && review.id && String(item.id) === String(review.id)
    ) || (
      item.comment && review.comment && String(item.comment) === String(review.comment)
    ));
    if (!duplicate) merged.push(review);
  }
  return merged;
}
