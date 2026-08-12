import { useRef, useState } from 'react';
import { artwork } from '../data/products';
import { getBrand } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { Link, localizePath } from '../routing/Router';

// VELVET brand landing page: existing brand hero on top, then a premium
// 2-column category explorer — one large preview panel and a vertical indexed
// category list. Each category links into the shared shop at
// /{locale}/products?brand=…&category=… — no cascade, filters or shop toolbar.
export default function BrandPage({ slug }) {
  const brand = getBrand(slug);
  const cursorRef = useRef(null);
  const listRef = useRef(null);
  const { copy, locale } = useI18n();
  const arrow = locale === 'ar' ? '←' : '→';

  const [activeIndex, setActiveIndex] = useState(0);
  const [fromSide, setFromSide] = useState('next');

  const selectIndex = (index) => {
    setFromSide(index > activeIndex ? 'next' : 'previous');
    setActiveIndex(index);
  };
  const scrollList = (dir) => {
    const el = listRef.current;
    if (el) el.scrollBy({ top: dir * (el.clientHeight * 0.85), behavior: 'smooth' });
  };

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
  const categoryHref = (item) => localizePath(`/brands/${slug}/category/${item.slug}`, locale);

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

      <section
        className="brand-explorer"
        id="category-products"
        style={{ '--c1': brand.home.palette[0], '--c2': brand.home.palette[1], '--c3': brand.home.palette[2] }}
        aria-label={`${brand.name[locale]} ${copy.shop.category}`}
      >
        <div className="brand-explorer__grid">
          <div className="brand-explorer__preview">
            <div className={`brand-explorer__panel is-${fromSide}`} key={category.slug}>
              <div className="brand-explorer__media">
                <img className="brand-explorer__art" src={artwork(category.name.en, brand.home.palette, (activeIndex % 6) + 1)} alt={category.name[locale]} />
              </div>
              <div className="brand-explorer__info">
                <span className="brand-explorer__eyebrow">{brand.name[locale]}</span>
                <h2 className="brand-explorer__title">{category.name[locale]}</h2>
                <p className="brand-explorer__subs">{category.subs.map((sub) => sub.name[locale]).join('  ·  ')}</p>
                <Link className="brand-explorer__cta" to={categoryHref(category)}>
                  <span>{copy.shop.shopBy}</span><b aria-hidden="true">{arrow}</b>
                </Link>
              </div>
            </div>
          </div>

          <div className="brand-explorer__list-wrap">
            <button type="button" className="brand-explorer__scroll" onClick={() => scrollList(-1)} aria-label={copy.category.previous}>↑</button>
            <ol className="brand-explorer__list" ref={listRef}>
              {brand.categories.map((item, index) => (
                <li key={item.slug}>
                  <button
                    type="button"
                    className={`brand-explorer__item ${index === activeIndex ? 'is-active' : ''}`}
                    onClick={() => selectIndex(index)}
                  >
                    <span className="brand-explorer__index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="brand-explorer__item-name">{item.name[locale]}</span>
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="brand-explorer__scroll" onClick={() => scrollList(1)} aria-label={copy.category.next}>↓</button>
          </div>
        </div>
      </section>
    </div>
  );
}