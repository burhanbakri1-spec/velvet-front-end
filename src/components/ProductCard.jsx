import { useEffect, useMemo, useState } from 'react';
import { Link } from '../routing/Router';
import { collectProductImages, getCategoryLabel, getProductBadge, getProductDescription, getProductName } from '../data/products';
import { getVelvetPathLabel } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { productStock } from '../data/inventory';

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

export default function ProductCard({ product, onAddToCart, onSelect, active = false }) {
  const { copy, locale } = useI18n();
  const badge = getProductBadge(product, locale);
  const name = getProductName(product, locale);
  const pathLabel = getVelvetPathLabel(product, locale) || getCategoryLabel(product.categoryId, locale);
  const images = useMemo(() => collectProductImages(product), [product]);
  const [imageIndex, setImageIndex] = useState(0);
  const quickAdd = onAddToCart ? (event) => onAddToCart(product, event) : undefined;
  const unavailable = product.inventoryManaged && productStock(product) <= 0;
  const activeImage = images[imageIndex] || product.image || '';
  const hasGallery = images.length > 1;

  useEffect(() => {
    setImageIndex(0);
  }, [product.id, product.slug]);

  const stepImage = (event, step) => {
    event.preventDefault();
    event.stopPropagation();
    if (!hasGallery) return;
    setImageIndex((current) => (current + step + images.length) % images.length);
  };

  const handleProductActivate = (event) => {
    if (!onSelect) return;
    event.preventDefault();
    onSelect(product);
  };

  return (
    <article className={`product-card ${active ? 'is-active' : ''}`}>
      <div className="product-card__media">
        <Link
          className="product-card__media-link"
          to={`/products/${product.slug}`}
          aria-label={`${copy.products.view} ${name}`}
          onClick={handleProductActivate}
        >
          {badge && <span className="product-card__badge">{badge}</span>}
          <img className="product-card__image" src={activeImage} alt={name} />
        </Link>
        {hasGallery && (
          <div className="product-card__gallery-nav" aria-hidden="false">
            <button
              type="button"
              className="product-card__gallery-btn product-card__gallery-btn--prev"
              aria-label={copy.detail.previousImage}
              onClick={(event) => stepImage(event, -1)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="product-card__gallery-btn product-card__gallery-btn--next"
              aria-label={copy.detail.nextImage}
              onClick={(event) => stepImage(event, 1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>
      <div className="product-card__body">
        <span className="product-card__category">{pathLabel}</span>
        <Link to={`/products/${product.slug}`} onClick={handleProductActivate}><h2>{name}</h2></Link>
        <p>{getProductDescription(product, locale, true)}</p>
        <div className="product-card__footer">
          <div className="product-price">
            <strong>{formatPrice(product.price)}</strong>
            {product.originalPrice && <del>{formatPrice(product.originalPrice)}</del>}
          </div>
          {onAddToCart ? (
            <button type="button" disabled={unavailable} className="product-card__add" onClick={quickAdd} aria-label={`${copy.products.open} ${name}`}>+</button>
          ) : (
            <Link className="product-card__arrow" to={`/products/${product.slug}`} aria-label={`${copy.products.open} ${name}`} onClick={handleProductActivate}>{locale === 'ar' ? '←' : '→'}</Link>
          )}
        </div>
      </div>
    </article>
  );
}
