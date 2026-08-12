import { useEffect, useRef, useState } from 'react';
import { artwork } from '../data/products';
import { getBrand } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';
import { shopHref } from '../hooks/useShopState';
import ProductShowcaseNavigation from '../components/ProductShowcaseNavigation';

// VELVET brand landing page: reuses the old CategoryPage visual language.
// Brand hero (VELVET logo + name + tagline) on top, then one horizontal
// carousel showing a single brand-category showcase at a time. Each card links
// into the shared shop at /{locale}/products?brand=…&category=… — no cascade,
// filters or shop toolbar.
export default function BrandPage({ slug }) {
  const brand = getBrand(slug);
  const cursorRef = useRef(null);
  const { copy, locale } = useI18n();
  const arrow = locale === 'ar' ? '←' : '→';

  const count = brand ? brand.categories.length : 0;
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState('next');

  const move = (step) => {
    if (count < 2) return;
    setDirection(step > 0 ? 'next' : 'previous');
    setActiveIndex((current) => (current + step + count) % count);
  };

  useEffect(() => {
    if (count < 2) return undefined;
    const timer = window.setTimeout(() => move(1), 5000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, count]);

  const moveCursor = (event) => {
    if (event.pointerType !== 'mouse' || window.innerWidth <= 760 || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const cursor = cursorRef.current;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.add('is-visible');
  };

  const hideCursor = () => cursorRef.current?.classList.remove('is-visible');

  if (!brand) {
    return (
      <section className="category-empty">
        <span className="store-eyebrow">VELVET</span>
        <h1>{copy.category.missing}</h1>
        <Link to="/products">{copy.category.allProducts}</Link>
      </section>
    );
  }

  const category = brand.categories[activeIndex];

  return (
    <div className="category-page">
      <section className="category-hero" onPointerEnter={moveCursor} onPointerMove={moveCursor} onPointerLeave={hideCursor}>
        <img className="category-hero__media" src={brand.image} alt="" />
        <div className="category-hero__shade" aria-hidden="true" />
        <a className="category-hero__link" href="#category-products" aria-label={`${copy.home.view} ${brand.name[locale]}`} />
        <div className="category-hero__title">
          <span>{brand.home.logo[locale]}</span>
          <h1>{brand.name[locale]}</h1>
        </div>
        <p className="category-hero__description">{brand.tagline[locale]}</p>
        <span className="showcase-view-cursor" ref={cursorRef} aria-hidden="true">{copy.home.view}</span>
      </section>

      <section className="category-product-showcase" id="category-products" aria-label={copy.shop.category}>
        <ProductShowcaseNavigation
          onPrevious={() => move(-1)}
          onNext={() => move(1)}
          previousLabel={copy.category.previous}
          nextLabel={copy.category.next}
          disabled={count < 2}
        />
        <div className={`category-product-showcase__slide is-${direction}`} key={category.slug}>
          <Link
            className="category-product-showcase__media"
            to={shopHref({ brand: slug, category: category.slug }, locale)}
            onPointerEnter={moveCursor}
            onPointerMove={moveCursor}
            onPointerLeave={hideCursor}
            aria-label={`${copy.home.view} ${category.name[locale]}`}
          >
            <img src={artwork(category.name.en, brand.home.palette, (activeIndex % 6) + 1)} alt={category.name[locale]} />
          </Link>
          <div className="category-product-showcase__copy">
            <span className="category-product-showcase__category">{brand.name[locale]}</span>
            <h2>{category.name[locale]}</h2>
            <p>{category.subs.map((sub) => sub.name[locale]).join(' · ')}</p>
            <Link className="category-product-showcase__cta" to={shopHref({ brand: slug, category: category.slug }, locale)}>
              <span>{copy.shop.shopBy}</span><b aria-hidden="true">{arrow}</b>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}