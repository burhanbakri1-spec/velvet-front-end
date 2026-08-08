import { useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { getAvailability, getCategoryLabel, getOptionName, getOptionValue, getProductBadge, getProductBySlug, getProductDescription, products } from '../data/products';
import { Link } from '../routing/Router';
import { useI18n } from '../i18n/I18nContext';

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

export default function ProductDetailsPage({ slug }) {
  const product = getProductBySlug(slug);
  const { addItem } = useCart();
  const { copy, locale } = useI18n();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const initialSelections = useMemo(() => Object.fromEntries((product?.options || []).map((option) => [option.name, option.values[0]?.label])), [product]);
  const [selections, setSelections] = useState(initialSelections);

  if (!product) {
    return <section className="store-not-found"><span className="store-eyebrow">{copy.detail.missingEyebrow}</span><h1>{copy.detail.missing}</h1><Link className="store-primary-button" to="/products">{copy.detail.back}</Link></section>;
  }

  const selectedImage = product.options.flatMap((option) => option.values).find((value) => Object.values(selections).includes(value.label) && value.image)?.image || product.image;
  const gallery = [...new Set([selectedImage, ...product.gallery])];
  const optionDelta = product.options.reduce((sum, option) => sum + Number(option.values.find((value) => value.label === selections[option.name])?.priceDelta || 0), 0);
  const currentPrice = product.price + optionDelta;
  const unavailable = product.availability === 'Out of stock';
  const related = [
    ...products.filter((item) => item.id !== product.id && item.categoryId === product.categoryId),
    ...products.filter((item) => item.id !== product.id && item.categoryId !== product.categoryId),
  ].slice(0, 4);

  const handleAdd = () => {
    if (unavailable) return;
    addItem(product, selections, quantity, selectedImage);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="product-detail-page">
      <div className="product-detail-breadcrumb"><Link to="/products">{copy.detail.breadcrumb}</Link><span>{locale === 'ar' ? '←' : '→'}</span><span>{product.name}</span></div>

      <section className="product-detail-main">
        <div className="product-gallery" aria-label={`${copy.detail.gallery} ${product.name}`}>
          {gallery.map((image, index) => <figure className="product-gallery__item" key={image}><img src={image} alt={`${product.name} ${copy.detail.imageView} ${index + 1}`} /></figure>)}
        </div>

        <aside className="product-purchase-panel">
          <div className="product-purchase-panel__top">
            <span className="product-detail-category">{getCategoryLabel(product.categoryId, locale)}</span>
            {product.badge && <span className="product-detail-badge">{getProductBadge(product, locale)}</span>}
          </div>
          <h1>{product.name}</h1>
          <div className="product-detail-price"><strong>{formatPrice(currentPrice)}</strong>{product.originalPrice && <del>{formatPrice(product.originalPrice + optionDelta)}</del>}</div>
          <p className="product-detail-description">{getProductDescription(product, locale)}</p>
          <p className={`product-availability ${unavailable ? 'is-out' : ''}`}><i />{getAvailability(product, locale)}</p>

          <div className="product-options">
            {product.options.map((option) => {
              const selectedValue = option.values.find((value) => value.label === selections[option.name]);
              return (
                <fieldset className="product-option" key={option.name}>
                  <legend>{getOptionName(option, locale)} <span>{selectedValue ? getOptionValue(selectedValue, locale) : ''}</span></legend>
                  <div className="product-option__values">
                    {option.values.map((value) => (
                      <button className={selections[option.name] === value.label ? 'is-active' : ''} onClick={() => setSelections((current) => ({ ...current, [option.name]: value.label }))} type="button" key={value.label}>
                        {value.color && <i style={{ background: value.color }} />}{getOptionValue(value, locale)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>

          <div className="product-buy-row">
            <div className="quantity-control" aria-label={copy.detail.quantity}>
              <button type="button" aria-label={copy.detail.decrease} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
              <span>{quantity}</span>
              <button type="button" aria-label={copy.detail.increase} onClick={() => setQuantity((value) => value + 1)}>+</button>
            </div>
            <button className="store-primary-button product-add-button" disabled={unavailable} onClick={handleAdd} type="button">{added ? copy.detail.added : unavailable ? copy.detail.unavailable : copy.detail.add}</button>
          </div>
          {added && <Link className="view-cart-link" to="/cart">{copy.detail.viewCart} {locale === 'ar' ? '←' : '→'}</Link>}
          <div className="product-detail-notes"><p><strong>{copy.detail.repeatTitle}</strong> {copy.detail.repeatBody}</p><p><strong>{copy.detail.returnsTitle}</strong> {copy.detail.returnsBody}</p></div>
        </aside>
      </section>

      <section className="related-products">
        <div className="related-products__head"><span className="store-eyebrow">{copy.detail.keep}</span><h2>{copy.detail.related}</h2></div>
        <div className="related-products__track">{related.map((item) => <ProductCard product={item} key={item.id} />)}</div>
      </section>
    </div>
  );
}
