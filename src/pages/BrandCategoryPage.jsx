import { useEffect, useRef, useState } from 'react';
import { artwork } from '../data/products';
import { filterProducts, getBrand, getCategory } from '../data/velvetCatalog';
import CategoryProductShowcase from '../components/CategoryProductShowcase';
import { useI18n } from '../i18n/I18nContext';
import { Link, localizePath } from '../routing/Router';
import { EMPTY_SHOP_STATE } from '../hooks/useShopState';
import { useCart } from '../context/CartContext';
import { productStock } from '../data/inventory';

// VELVET brand + category landing: reuses the old CategoryPage visual
// language — a category hero (brand eyebrow + category title + subcategory
// summary) on top, then the existing CategoryProductShowcase fed exclusively
// with products from this exact brand + category. No shop bar, no filters,
// no TreeMap, no cascade dropdowns.
export default function BrandCategoryPage({ slug, categorySlug }) {
  const brand = getBrand(slug);
  const category = brand ? getCategory(brand.slug, categorySlug) : null;
  const cursorRef = useRef(null);
  const { copy, locale } = useI18n();
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const addTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(addTimer.current), []);

  const handleAddToCart = (product) => {
    if (product.inventoryManaged && productStock(product) <= 0) return;
    addItem(product);
    setJustAdded(true);
    window.clearTimeout(addTimer.current);
    addTimer.current = window.setTimeout(() => setJustAdded(false), 1500);
  };

  const addToCartLabel = justAdded ? (locale === 'ar' ? 'تمت الإضافة ✓' : 'Added ✓') : copy.detail.add;

  const moveCursor = (event) => {
    if (event.pointerType !== 'mouse' || window.innerWidth <= 760 || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const cursor = cursorRef.current;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.add('is-visible');
  };

  const hideCursor = () => cursorRef.current?.classList.remove('is-visible');

  if (!brand || !category) {
    return (
      <section className="category-empty">
        <span className="store-eyebrow">VELVET</span>
        <h1>{copy.category.missing}</h1>
        <Link to={localizePath(`/brands/${slug}`, locale)}>{copy.category.allProducts}</Link>
      </section>
    );
  }

  const categoryIndex = brand.categories.findIndex((item) => item.slug === category.slug);
  const heroImage = category.heroImage || artwork(category.name.en, brand.home.palette, (categoryIndex % 6) + 1);
  const heroDescription = category.subs.length
    ? category.subs.map((sub) => sub.name[locale]).join(' · ')
    : (category.description?.[locale] || '');
  const products = filterProducts({ ...EMPTY_SHOP_STATE, brand: slug, category: categorySlug });

  return (
    <div className="category-page">
      <section className="category-hero" onPointerEnter={moveCursor} onPointerMove={moveCursor} onPointerLeave={hideCursor}>
        {category.heroVideo ? (
          <video className="category-hero__media" src={category.heroVideo} poster={heroImage} autoPlay muted loop playsInline />
        ) : (
          <img className="category-hero__media" src={heroImage} alt="" />
        )}
        <div className="category-hero__shade" aria-hidden="true" />
        <a className="category-hero__link" href="#category-products" aria-label={`${copy.home.view} ${category.name[locale]}`} />
        <div className="category-hero__title">
          <span>{brand.name[locale]}</span>
          <h1>{category.name[locale]}</h1>
        </div>
        <p className="category-hero__description">{heroDescription}</p>
        <span className="showcase-view-cursor" ref={cursorRef} aria-hidden="true">{copy.home.view}</span>
      </section>

      {products.length > 0 ? (
        <CategoryProductShowcase
          category={category}
          products={products}
          onAddToCart={handleAddToCart}
          addToCartLabel={addToCartLabel}
        />
      ) : (
        <section className="category-empty" id="category-products">
          <span className="store-eyebrow">{brand.name[locale]}</span>
          <h2>{copy.category.empty}</h2>
          <Link to={localizePath(`/products?brand=${slug}&category=${categorySlug}`, locale)}>{copy.category.allProducts}</Link>
        </section>
      )}
    </div>
  );
}
