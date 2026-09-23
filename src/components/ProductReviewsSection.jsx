import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Link, localizePath, useRouter } from '../routing/Router';
import { getProductReviews, persistSubmittedReview, submitReview } from '../data/reviews';

/**
 * PDP reviews: approved product reviews + a review form for logged-in
 * customers. Guests are pointed to /login?return=… instead of a silent fail.
 */
export default function ProductReviewsSection({ productId }) {
  const { copy, locale } = useI18n();
  const { isAuthenticated, token, customer } = useAuth();
  const { location, navigate } = useRouter();
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!productId) return undefined;
    let cancelled = false;
    getProductReviews(productId, { token }).then((result) => {
      if (cancelled) return;
      if (result.ok) setReviews(result.reviews);
    }).catch(() => { /* keep empty */ });
    return () => { cancelled = true; };
  }, [productId, token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    if (!isAuthenticated) {
      const returnPath = `${location.pathname}${location.search}`;
      navigate(`/login?return=${encodeURIComponent(returnPath)}`);
      return;
    }
    setPending(true);
    try {
      const result = await submitReview({ scope: 'product', productId, rating, comment }, token);
      if (result.ok) {
        persistSubmittedReview({ scope: 'product', productId, rating, comment }, customer);
        setComment('');
        setStatus({ tone: 'info', message: copy.reviews.submitSuccess });
      } else {
        setStatus({ tone: 'error', message: result.message || copy.reviews.submitError });
      }
    } catch {
      setStatus({ tone: 'error', message: copy.reviews.submitError });
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="product-reviews" aria-label={copy.reviews.title}>
      <div className="product-detail-section-head">
        <span className="store-eyebrow">{copy.reviews.eyebrow}</span>
        <h2>{copy.reviews.title}</h2>
      </div>

      {reviews.length > 0 ? (
        <ul className="product-reviews__list">
          {reviews.map((review, index) => (
            <li className="product-review" key={review.id || `${review.productId}-${index}`}>
              <div className="product-review__stars" aria-label={`${review.rating} / 5`}>
                {'★'.repeat(Math.max(1, Math.min(5, Number(review.rating) || 5)))}
              </div>
              <p>{review.comment}</p>
              <small>{review.name || review.customerName || (locale === 'ar' ? 'عميل VELVET' : 'VELVET customer')}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="auth-panel__note">{copy.reviews.empty}</p>
      )}

      {isAuthenticated ? (
        <form className="auth-form product-review-form" onSubmit={handleSubmit}>
          <label>
            <span>{copy.reviews.rating}</span>
            <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>{'★'.repeat(value)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.reviews.comment}</span>
            <textarea
              required
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={copy.reviews.commentPlaceholder}
            />
          </label>
          <div className="auth-form__actions">
            <button className="store-primary-button" type="submit" disabled={pending}>
              {pending ? copy.reviews.submitting : copy.reviews.submit}
              <i>{locale === 'ar' ? '←' : '→'}</i>
            </button>
          </div>
        </form>
      ) : (
        <p className="auth-panel__footer">
          <Link to={`/login?return=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>
            {copy.reviews.guestPrompt}
          </Link>
        </p>
      )}

      {status ? (
        <p className={`auth-panel__status auth-panel__status--${status.tone}`} role="status">{status.message}</p>
      ) : null}
    </section>
  );
}