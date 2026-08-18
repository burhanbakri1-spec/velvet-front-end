import { useRef, useState } from 'react';
import { getAvailability, getOptionName, getProductDescription } from '../data/products';
import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';
import ProductShowcaseNavigation from './ProductShowcaseNavigation';
import { productStock } from '../data/inventory';

export default function CategoryProductShowcase({ category, products, onAddToCart, addToCartLabel }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState('next');
  const cursorRef = useRef(null);
  const { copy, locale } = useI18n();
  const product = products[activeIndex];

  const move = (step) => {
    if (products.length < 2) return;
    setDirection(step > 0 ? 'next' : 'previous');
    setActiveIndex((current) => (current + step + products.length) % products.length);
  };

  const moveCursor = (event) => {
    if (event.pointerType !== 'mouse' || window.innerWidth <= 760 || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const cursor = cursorRef.current;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.add('is-visible');
  };
  const hideCursor = () => cursorRef.current?.classList.remove('is-visible');

  if (!product) return null;
  const optionSummary = product.options.map((option) => getOptionName(option, locale)).join(' · ');
  const unavailable = product.inventoryManaged ? productStock(product) <= 0 : product.availability === 'Out of stock';

  return (
    <section className="category-product-showcase" id="category-products" aria-live="polite">
      <ProductShowcaseNavigation
        onPrevious={() => move(-1)}
        onNext={() => move(1)}
        previousLabel={copy.category.previous}
        nextLabel={copy.category.next}
        disabled={products.length < 2}
      />
      <div className={`category-product-showcase__slide is-${direction}`} key={product.id}>
        <Link
          className="category-product-showcase__media"
          to={`/products/${product.slug}`}
          onPointerEnter={moveCursor}
          onPointerMove={moveCursor}
          onPointerLeave={hideCursor}
          aria-label={`${copy.category.viewProduct}: ${product.name}`}
        >
          <img src={product.image} alt={product.name} />
        </Link>
        <div className="category-product-showcase__copy">
          <span className="category-product-showcase__category">{category.name[locale]}</span>
          <h2>{product.name}</h2>
          <p>{getProductDescription(product, locale)}</p>
          <div className="category-product-showcase__commerce">
            <div className="category-product-showcase__price">
              <strong>${product.price.toFixed(2)}</strong>
              {product.originalPrice && <del>${product.originalPrice.toFixed(2)}</del>}
            </div>
            <span className={`category-product-showcase__availability ${unavailable ? 'is-unavailable' : ''}`}>{getAvailability(product, locale)}</span>
            {optionSummary && <span className="category-product-showcase__variants">{copy.category.variants}: {optionSummary}</span>}
          </div>
          <div className="category-product-showcase__actions">
            <Link className="category-product-showcase__cta" to={`/products/${product.slug}`}>
              <span>{copy.category.viewProduct}</span><b aria-hidden="true">{locale === 'ar' ? '←' : '→'}</b>
            </Link>
            {onAddToCart && (
              <button type="button" disabled={unavailable} className="category-product-showcase__cta category-product-showcase__cta--secondary" onClick={() => onAddToCart(product)}>
                <span>{addToCartLabel}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <span className="category-product-showcase__count">{String(activeIndex + 1).padStart(2, '0')} / {String(products.length).padStart(2, '0')}</span>
      <span className="showcase-view-cursor" ref={cursorRef} aria-hidden="true">{copy.home.view}</span>
    </section>
  );
}
