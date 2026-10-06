import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '../routing/Router';
import { collectProductImages, getProductBadge, getProductName } from '../data/products';
import { formatPrice } from '../data/currency';
import { selectBrandStripProducts } from '../data/brandProductStrip';
import { orderedIdsForHome } from '../data/displayPriority';
import { getBrand, velvetProducts } from '../data/velvetCatalog';
import { normalizeStripScroll, STRIP_GROUPS } from '../hooks/stripScroll';
import { useI18n } from '../i18n/I18nContext';

const RESUME_DELAY_MS = 3200;

export default function BrandProductStrip({ brandSlug }) {
  const { copy, locale } = useI18n();
  const arrow = locale === 'ar' ? '←' : '→';
  const source = velvetProducts;
  const products = useMemo(() => {
    const orderedIds = orderedIdsForHome(brandSlug);
    return selectBrandStripProducts(source, brandSlug, Array.isArray(orderedIds) ? { orderedIds } : {});
  }, [source, brandSlug]);
  const [paused, setPaused] = useState(false);
  const resumeTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(resumeTimerRef.current), []);

  const pauseForInteraction = () => {
    setPaused(true);
    window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => setPaused(false), RESUME_DELAY_MS);
  };

  if (!brandSlug || products.length === 0) return null;

  const brandName = getBrand(brandSlug)?.name?.[locale] || '';
  const viewAllTo = `/products?brand=${encodeURIComponent(brandSlug)}`;

  const renderCard = (product, focusable) => {
    const name = getProductName(product, locale);
    const badge = getProductBadge(product, locale);
    const images = collectProductImages(product);
    const image = images[0] || product.image || '';
    return (
      <Link
        className="brand-strip-card"
        to={`/products/${product.slug}`}
        key={`${brandSlug}-${product.id}`}
        tabIndex={focusable ? undefined : -1}
      >
        <span className="brand-strip-card__media">
          {badge && <span className="brand-strip-card__badge">{badge}</span>}
          <img className="brand-strip-card__image" src={image} alt={name} loading="lazy" decoding="async" />
        </span>
        <span className="brand-strip-card__name">{name}</span>
        <span className="brand-strip-card__price">
          <strong>{formatPrice(product.price)}</strong>
          {product.originalPrice && <del>{formatPrice(product.originalPrice)}</del>}
        </span>
      </Link>
    );
  };

  const renderGroup = (index) => (
    <div
      className="brand-strip__group"
      key={`group-${index}`}
      aria-hidden={index === 0 ? undefined : 'true'}
    >
      {products.map((product) => renderCard(product, index === 0))}
    </div>
  );

  return (
    <section
      className="brand-strip"
      data-brand={brandSlug}
      aria-label={brandName ? `${copy.home.featuredPicks} · ${brandName}` : copy.home.featuredPicks}
    >
      <div className="brand-strip__head">
        <h3 className="brand-strip__title">{copy.home.featuredPicks}</h3>
        <Link className="brand-strip__all" to={viewAllTo}>
          <span>{copy.home.viewAll}</span>
          <span aria-hidden="true">{arrow}</span>
        </Link>
      </div>
      <div
        className="brand-strip__viewport"
        onPointerDown={pauseForInteraction}
        onTouchStart={pauseForInteraction}
        onScroll={normalizeStripScroll}
      >
        <div
          className={`brand-strip__track${paused ? ' is-paused' : ''}`}
          style={{ '--strip-groups': STRIP_GROUPS }}
        >
          {Array.from({ length: STRIP_GROUPS }, (_, index) => renderGroup(index))}
        </div>
      </div>
    </section>
  );
}
