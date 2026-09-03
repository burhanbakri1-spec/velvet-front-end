import {
  getAvailability,
  getOptionName,
  getOptionValue,
  getProductBadge,
  getProductDescription,
  getProductName,
} from '../data/products';
import { optionValueUnavailable, coerceSelectionsToValidVariant } from '../data/inventory';
import { Link } from '../routing/Router';

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

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
}) {
  const productName = getProductName(product, locale);
  const optionDelta = product.options.reduce(
    (sum, option) => sum + Number(option.values.find((value) => value.label === selections[option.name])?.priceDelta || 0),
    0,
  );
  const currentPrice = product.price + optionDelta;
  const optionSummary = product.options.map((option) => getOptionName(option, locale)).join(' · ');

  return (
    <div className={`category-product-showcase__slide product-switcher-slide__content${showMedia ? '' : ' product-detail-slide--commerce-only'}`}>
      {showMedia && (
        <div className="product-detail-focal">
          <figure className="category-product-showcase__media product-detail-hero__media">
            <img className="product-detail-focal__image" src={imageSrc} alt={productName} />
          </figure>
        </div>
      )}
      <div className="category-product-showcase__copy">
        <span className="category-product-showcase__category">
          {eyebrow}
          {product.badge && <span className="product-detail-badge">{getProductBadge(product, locale)}</span>}
        </span>
        <h1>{productName}</h1>
        <p>{getProductDescription(product, locale, true)}</p>
        <div className="category-product-showcase__commerce">
          <div className="category-product-showcase__price">
            <strong>{formatPrice(currentPrice)}</strong>
            {product.originalPrice && <del>{formatPrice(product.originalPrice + optionDelta)}</del>}
          </div>
          <span className={`category-product-showcase__availability ${unavailable ? 'is-unavailable' : ''}`}>{getAvailability(product, locale)}</span>
          {optionSummary && <span className="category-product-showcase__variants">{copy.category.variants}: {optionSummary}</span>}
        </div>

        {product.options.length > 0 && (
          <div className="product-detail-options">
            {product.options.map((option) => {
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
      </div>
    </div>
  );
}
