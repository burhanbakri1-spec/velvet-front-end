import { useEffect, useRef, useState } from 'react';
import { artwork } from '../data/products';
import { filterProducts, getBrand, getCategory, getSubcategory } from '../data/velvetCatalog';
import CategoryProductShowcase from '../components/CategoryProductShowcase';
import PageNavigation from '../components/PageNavigation';
import { useI18n } from '../i18n/I18nContext';
import { Link, localizePath } from '../routing/Router';
import { EMPTY_SHOP_STATE } from '../hooks/useShopState';
import { useCart } from '../context/CartContext';
import { productStock } from '../data/inventory';

// Shared Brand + Category landing for both Main Category and Subcategory modes.
// Same visual page (category-hero + showcase). Subcategory mode replaces
// Main Category content in place — never stacks both.
export default function BrandCategoryPage({ slug, categorySlug, subcategorySlug }) {
  const brand = getBrand(slug);
  const category = brand ? getCategory(brand.slug, categorySlug) : null;
  const subcategory = category && subcategorySlug
    ? getSubcategory(brand.slug, category.slug, subcategorySlug)
    : null;
  const isSubMode = Boolean(subcategorySlug);
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

  if (!brand || !category || (isSubMode && !subcategory)) {
    return (
      <section className="category-empty">
        <span className="store-eyebrow">VELVET</span>
        <h1>{copy.category.missing}</h1>
        <Link to={localizePath(`/brands/${slug}`, locale)}>{copy.category.allProducts}</Link>
      </section>
    );
  }

  const active = isSubMode ? subcategory : category;
  const categoryIndex = brand.categories.findIndex((item) => item.slug === category.slug);
  const mainHeroImage = category.heroImage || artwork(category.name.en, brand.home.palette, (categoryIndex % 6) + 1);
  const heroVideo = isSubMode ? (subcategory.heroVideo || '') : (category.heroVideo || '');
  const heroImage = isSubMode
    ? (subcategory.image || '')
    : mainHeroImage;
  const hasHeroMedia = Boolean(heroVideo || heroImage);
  const heroDescription = isSubMode
    ? (subcategory.description?.[locale] || '')
    : (category.subs.length
      ? category.subs.map((sub) => sub.name[locale]).join(' · ')
      : (category.description?.[locale] || ''));
  const products = filterProducts({
    ...EMPTY_SHOP_STATE,
    brand: slug,
    category: categorySlug,
    ...(isSubMode ? { subcategory: subcategorySlug } : {}),
  });
  const shopHref = isSubMode
    ? `/products?brand=${encodeURIComponent(slug)}&category=${encodeURIComponent(categorySlug)}&subcategory=${encodeURIComponent(subcategorySlug)}`
    : `/products?brand=${encodeURIComponent(slug)}&category=${encodeURIComponent(categorySlug)}`;

  return (
    <div className="category-page">
      <PageNavigation
        fallbackPath={`/brands/${slug}`}
        breadcrumbs={[
          { label: brand.name[locale], to: `/brands/${slug}` },
          {
            label: category.name[locale],
            to: isSubMode ? `/brands/${slug}/category/${categorySlug}` : undefined,
          },
          ...(isSubMode ? [{ label: subcategory.name[locale] }] : []),
        ]}
      />
      <section className="category-hero" onPointerEnter={moveCursor} onPointerMove={moveCursor} onPointerLeave={hideCursor}>
        {hasHeroMedia && (
          heroVideo ? (
            <video className="category-hero__media" src={heroVideo} poster={heroImage || undefined} autoPlay muted loop playsInline />
          ) : (
            <img className="category-hero__media" src={heroImage} alt="" />
          )
        )}
        <div className="category-hero__shade" aria-hidden="true" />
        <a className="category-hero__link" href="#category-products" aria-label={`${copy.home.view} ${active.name[locale]}`} />
        <div className="category-hero__title">
          <span>{brand.name[locale]}</span>
          <h1>{active.name[locale]}</h1>
        </div>
        {heroDescription ? <p className="category-hero__description">{heroDescription}</p> : null}
        <span className="showcase-view-cursor" ref={cursorRef} aria-hidden="true">{copy.home.view}</span>
      </section>

      {!isSubMode && category.subs.length > 0 && (
        <nav className="category-subnav" aria-label={copy.shop.subcategory}>
          {category.subs.map((sub) => (
            <Link
              key={sub.slug}
              to={localizePath(`/brands/${slug}/category/${categorySlug}/subcategory/${sub.slug}`, locale)}
            >
              {sub.name[locale]}
            </Link>
          ))}
        </nav>
      )}

      {products.length > 0 ? (
        <CategoryProductShowcase
          key={isSubMode ? subcategory.slug : category.slug}
          category={active}
          products={products}
          onAddToCart={handleAddToCart}
          addToCartLabel={addToCartLabel}
        />
      ) : (
        <section className="category-empty" id="category-products">
          <span className="store-eyebrow">{brand.name[locale]}</span>
          <h2>{copy.category.empty}</h2>
          <Link to={localizePath(shopHref, locale)}>{copy.category.allProducts}</Link>
        </section>
      )}
    </div>
  );
}
