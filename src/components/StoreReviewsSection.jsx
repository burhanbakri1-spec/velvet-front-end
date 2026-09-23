import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { getStoreReviews } from '../data/reviews';
import { isStorefrontApiConfigured } from '../data/apiClient';

/**
 * Modest homepage section showing approved store reviews (scope=store).
 * Renders nothing when the API is not configured or no approved reviews exist.
 */
export default function StoreReviewsSection() {
  const { copy, locale } = useI18n();
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isStorefrontApiConfigured()) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    getStoreReviews().then((result) => {
      if (cancelled) return;
      if (result.ok) setReviews(result.reviews);
    }).catch(() => { /* keep empty */ }).finally(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!loaded || reviews.length === 0) return null;

  return (
    <section className="store-reviews" aria-label={copy.reviews.storeTitle}>
      <div className="store-reviews__head">
        <span className="store-eyebrow">{copy.reviews.storeEyebrow}</span>
        <h2>{copy.reviews.storeTitle}</h2>
      </div>
      <div className="store-reviews__track">
        {reviews.slice(0, 6).map((review, index) => (
          <figure className="store-review" key={review.id || `${review.scope}-${index}`}>
            <div className="store-review__stars" aria-label={`${review.rating} / 5`}>
              {'★'.repeat(Math.max(1, Math.min(5, Number(review.rating) || 5)))}
            </div>
            <blockquote>{review.comment}</blockquote>
            <figcaption>
              {review.name || review.customerName || (locale === 'ar' ? 'عميل VELVET' : 'VELVET customer')}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}