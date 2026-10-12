import {
  getAvailability,
  getCustomerFacingOptionLabels,
  getCustomerFacingOptions,
  getOptionName,
  getOptionValue,
  getProductBadge,
  getProductName,
} from '../data/products';
import { getProductSlidePercent } from '../hooks/productSiblings';
import { optionValueUnavailable, coerceSelectionsToValidVariant } from '../data/inventory';
import { Link } from '../routing/Router';
import { formatPrice } from '../data/currency';
import FavoriteButton from './FavoriteButton';

export default function ProductDetailSlide({
  product,
  locale,
  copy,
  eyebrow,
  imageSrc,
  selections,
  quantity,
  added,
  unavailable,
  stockLimit,
  onSelections,
  onQuantity,
  onAdd,
  onBuyNow,
  interactive = true,
  showMedia = true,
  showCopy = true,
  productTitle,
  titleMotion = null,
}) {
  const productName = productTitle || getProductName(product, locale);
  const titleStyle = (role) => {
    if (!titleMotion) return undefined;
    const { start, end } = getProductSlidePercent(titleMotion.direction, role, titleMotion.rtl);
    const percent = titleMotion.animating ? end : start;
    const opacity = titleMotion.animating
      ? (role === 'outgoing' ? 0 : 1)
      : (role === 'outgoing' ? 1 : 0);
    return { transform: `translate3d(${percent}%, 0, 0)`, opacity };
  };
  const optionDelta = product.options.reduce(
    (sum, option) => sum + Number(option.values.find((value) => value.label === selections[option.name])?.priceDelta || 0),
    0,
  );
  const currentPrice = product.price + optionDelta;
  const facingOptions = getCustomerFacingOptions(product);
  const optionSummary = getCustomerFacingOptionLabels(product, locale).join(' · ');

  return (
    <div className={`category-product-showcase__slide product-switcher-slide__content${showMedia ? '' : ' product-detail-slide--commerce-only'}`}>
      {showMedia && (
        <div className="product-detail-focal">
          <figure className="category-product-showcase__media product-detail-hero__media">
            <img className="product-detail-focal__image" src={imageSrc} alt={productName} />
          </figure>
        </div>
      )}
      {showCopy && <div className="category-product-showcase__copy">
        <span className="category-product-showcase__category">
          {eyebrow}
          {product.badge && <span className="product-detail-badge">{getProductBadge(product, locale)}</span>}
        </span>
        <h1 className={`product-detail-title${titleMotion ? ' is-transitioning' : ''}`}>
          {titleMotion ? (
            <>
              <span className="product-detail-title__slide" style={titleStyle('outgoing')}>{titleMotion.fromTitle}</span>
              <span className="product-detail-title__slide" style={titleStyle('incoming')}>{titleMotion.toTitle}</span>
            </>
          ) : (
            <span className="product-detail-title__slide">{productName}</span>
          )}
        </h1>
        <FavoriteButton productId={product.id} className="product-detail-favorite" />
        <div className="category-product-showcase__commerce">
          <div className="category-product-showcase__price">
            <strong>{formatPrice(currentPrice)}</strong>
            {product.originalPrice && <del>{formatPrice(product.originalPrice + optionDelta)}</del>}
          </div>
          <span className={`category-product-showcase__availability ${unavailable ? 'is-unavailable' : ''}`}>{getAvailability(product, locale)}</span>
          {optionSummary && <span className="category-product-showcase__variants">{copy.category.variants}: {optionSummary}</span>}
        </div>

        {facingOptions.length > 0 && (
          <div className="product-detail-options">
            {facingOptions.map((option) => {
              const selectedValue = option.values.find((value) => value.label === selections[option.name]);
              return (
                <fieldset className="product-option product-detail-option" key={option.name}>
                  <legend>{getOptionName(option, locale)} <span>{selectedValue ? getOptionValue(selectedValue, locale) : ''}</span></legend>
                  <div className="product-option__values">
                    {option.values.map((value) => {
                      const disabled = optionValueUnavailable(product, selections, option.name, value.label);
                      return (
                        <button
                          disabled={disabled || !interactive}
                          aria-disabled={disabled || !interactive}
                          className={selections[option.name] === value.label ? 'is-active' : ''}
                          onClick={() => interactive && onSelections((current) => coerceSelectionsToValidVariant(
                            product,
                            { ...current, [option.name]: value.label },
                          ))}
                          type="button"
                          key={value.label}
                        >
                          {value.color && <i style={{ background: value.color }} />}
                          {getOptionValue(value, locale)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}

        <div className="product-detail-buy">
          <div className="quantity-control product-detail-qty" aria-label={copy.detail.quantity}>
            <button type="button" disabled={!interactive} aria-label={copy.detail.decrease} onClick={() => interactive && onQuantity((value) => Math.max(1, value - 1))}>−</button>
            <span>{quantity}</span>
            <button
              type="button"
              disabled={!interactive || (Number.isFinite(stockLimit) && quantity >= stockLimit)}
              aria-label={copy.detail.increase}
              onClick={() => interactive && onQuantity((value) => (Number.isFinite(stockLimit) ? Math.min(stockLimit, value + 1) : value + 1))}
            >
              +
            </button>
          </div>
          <button className="store-primary-button product-detail-buy__primary" type="button" disabled={unavailable || !interactive} onClick={onAdd}>{added ? copy.detail.added : unavailable ? copy.detail.unavailable : copy.detail.add}</button>
          <button className="store-primary-button product-detail-buy__secondary" type="button" disabled={unavailable || !interactive} onClick={onBuyNow}>{copy.detail.buyNow}</button>
        </div>
        {added && interactive && <Link className="view-cart-link product-detail-cart-link" to="/cart">{copy.detail.viewCart} {locale === 'ar' ? '←' : '→'}</Link>}
      </div>}
    </div>
  );
}
