import { Link } from '../routing/Router';
import { getCategoryLabel, getProductBadge, getProductDescription } from '../data/products';
import { getVelvetPathLabel } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { productStock } from '../data/inventory';

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

export default function ProductCard({ product, onAddToCart }) {
  const { copy, locale } = useI18n();
  const badge = getProductBadge(product, locale);
  const pathLabel = getVelvetPathLabel(product, locale) || getCategoryLabel(product.categoryId, locale);
  const quickAdd = onAddToCart ? (event) => onAddToCart(product, event) : undefined;
  const unavailable = product.inventoryManaged && productStock(product) <= 0;
  return (
    <article className="product-card">
      <Link className="product-card__media" to={`/products/${product.slug}`} aria-label={`${copy.products.view} ${product.name}`}>
        {badge && <span className="product-card__badge">{badge}</span>}
        <img className="product-card__image product-card__image--primary" src={product.image} alt={product.name} />
        {product.hoverImage && product.hoverImage !== product.image && <img className="product-card__image product-card__image--hover" src={product.hoverImage} alt="" aria-hidden="true" />}
      </Link>
      <div className="product-card__body">
        <span className="product-card__category">{pathLabel}</span>
        <Link to={`/products/${product.slug}`}><h2>{product.name}</h2></Link>
        <p>{getProductDescription(product, locale, true)}</p>
        <div className="product-card__footer">
          <div className="product-price">
            <strong>{formatPrice(product.price)}</strong>
            {product.originalPrice && <del>{formatPrice(product.originalPrice)}</del>}
          </div>
          {onAddToCart ? (
            <button type="button" disabled={unavailable} className="product-card__add" onClick={quickAdd} aria-label={`${copy.products.open} ${product.name}`}>+</button>
          ) : (
            <Link className="product-card__arrow" to={`/products/${product.slug}`} aria-label={`${copy.products.open} ${product.name}`}>{locale === 'ar' ? '←' : '→'}</Link>
          )}
        </div>
      </div>
    </article>
  );
}
