import { useEffect, useMemo, useRef, useState } from 'react';
import ProductCard from '../components/ProductCard';
import ProductShowcaseNavigation from '../components/ProductShowcaseNavigation';
import PageNavigation from '../components/PageNavigation';
import { useCart } from '../context/CartContext';
import { getAvailability, getCategoryLabel, getOptionName, getOptionValue, getProductBadge, getProductDescription } from '../data/products';
import { filterGroups, getBrand, getCategory, getProductBySlug, getProductMedia, getVelvetPathLabel, velvetProducts } from '../data/velvetCatalog';
import { Link, localizePath, useRouter } from '../routing/Router';
import { useI18n } from '../i18n/I18nContext';
import { availableStock, optionValueUnavailable, selectedVariant } from '../data/inventory';

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

export default function ProductDetailsPage({ slug }) {
  const product = getProductBySlug(slug);
  const { copy, locale } = useI18n();
  const { navigate } = useRouter();
  const { addItem } = useCart();

  const initialSelections = useMemo(() => Object.fromEntries((product?.options || []).map((option) => [option.name, option.values[0]?.label || ''])), [product]);
  const [selections, setSelections] = useState(initialSelections);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [direction, setDirection] = useState('next');
  const [activeImage, setActiveImage] = useState(product?.image || '');
  const addedTimer = useRef(null);

  // Products of the same VELVET category give the previous / next loop. Without a
  // velvet path the product is the only item in its "category".
  const sameCategory = useMemo(() => {
    if (!product?.velvetPath) return product ? [product] : [];
    return velvetProducts.filter((item) => item.velvetPath?.brandId === product.velvetPath.brandId && item.velvetPath?.categoryId === product.velvetPath.categoryId);
  }, [product]);

  const currentIndex = Math.max(0, sameCategory.findIndex((item) => item.id === product?.id));
  const previousProduct = sameCategory[(currentIndex - 1 + sameCategory.length) % sameCategory.length];
  const nextProduct = sameCategory[(currentIndex + 1) % sameCategory.length];

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);
  const activeVariant = selectedVariant(product, selections);
  const stockLimit = availableStock(product, selections);
  const unavailable = product?.inventoryManaged ? stockLimit <= 0 : product?.availability === 'Out of stock';
  useEffect(() => {
    if (Number.isFinite(stockLimit)) setQuantity((value) => Math.max(1, Math.min(stockLimit || 1, value)));
  }, [stockLimit]);

  const go = (step) => {
    if (sameCategory.length < 2) return;
    const target = step > 0 ? nextProduct : previousProduct;
    if (!target) return;
    setDirection(step > 0 ? 'next' : 'previous');
    navigate(localizePath(`/products/${target.slug}`, locale));
  };

  if (!product) {
    return <section className="store-not-found"><span className="store-eyebrow">{copy.detail.missingEyebrow}</span><h1>{copy.detail.missing}</h1><Link className="store-primary-button" to="/products">{copy.detail.back}</Link></section>;
  }

  const gallery = [...new Set([product.image, ...(product.gallery || [])])];
  if (!gallery.includes(activeImage)) setActiveImage(gallery[0]);

  const productMedia = getProductMedia(product);
  const optionDelta = product.options.reduce((sum, option) => sum + Number(option.values.find((value) => value.label === selections[option.name])?.priceDelta || 0), 0);
  const currentPrice = product.price + optionDelta;
  const optionSummary = product.options.map((option) => getOptionName(option, locale)).join(' · ');
  const brand = product.velvetPath?.brandId ? getBrand(product.velvetPath.brandId) : null;
  const category = product.velvetPath ? getCategory(product.velvetPath.brandId, product.velvetPath.categoryId) : null;
  const eyebrow = category?.name[locale] || getVelvetPathLabel(product, locale) || getCategoryLabel(product.categoryId, locale);

  const metres = {
    age: filterGroups.age.find((item) => item.id === product.age),
    skill: filterGroups.skill.find((item) => item.id === product.skill),
  };

  const related = [
    ...velvetProducts.filter((item) => item.id !== product.id && item.velvetPath?.brandId === product.velvetPath?.brandId && item.velvetPath?.categoryId === product.velvetPath?.categoryId),
    ...velvetProducts.filter((item) => item.id !== product.id && item.velvetPath?.brandId === product.velvetPath?.brandId && item.velvetPath?.categoryId !== product.velvetPath?.categoryId),
    ...velvetProducts.filter((item) => item.id !== product.id && (!product.velvetPath?.brandId || item.velvetPath?.brandId !== product.velvetPath.brandId)),
  ].slice(0, 4);

  const handleAdd = (event) => {
    event.preventDefault();
    if (unavailable) return;
    addItem(product, selections, Math.min(quantity, stockLimit), activeImage, activeVariant);
    setAdded(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), 1800);
  };

  const handleBuyNow = (event) => {
    event.preventDefault();
    if (unavailable) return;
    addItem(product, selections, Math.min(quantity, stockLimit), activeImage, activeVariant);
    navigate(localizePath('/checkout', locale));
  };

  const specs = [];
  if (brand) specs.push({ label: copy.shop.brand, value: brand.name[locale] });
  if (eyebrow) specs.push({ label: copy.shop.category, value: eyebrow });
  if (product.manufacturer) specs.push({ label: copy.shop.manufacturer, value: product.manufacturer });
  if (metres.age) specs.push({ label: copy.detail.age, value: metres.age.name[locale] });
  if (metres.skill) specs.push({ label: copy.detail.skill, value: metres.skill.name[locale] });
  if (product.options.length > 0) specs.push({ label: copy.category.variants, value: optionSummary });
  specs.push({ label: copy.detail.stock, value: getAvailability(product, locale) });

  const detailBreadcrumbs = [{ label: copy.meta.home, to: '/' }];
  if (brand) detailBreadcrumbs.push({ label: brand.name[locale], to: `/brands/${product.velvetPath.brandId}` });
  if (category) detailBreadcrumbs.push({ label: category.name[locale], to: `/products?brand=${product.velvetPath.brandId}&category=${product.velvetPath.categoryId}` });
  detailBreadcrumbs.push({ label: product.name });

  const detailFallback = product.velvetPath
    ? `/products?brand=${product.velvetPath.brandId}&category=${product.velvetPath.categoryId}`
    : '/products';

  return (
    <div className="product-detail-page">
      <PageNavigation fallbackPath={detailFallback} breadcrumbs={detailBreadcrumbs} />
      <section className="category-product-showcase category-product-showcase--detail" aria-label={product.name}>
        <ProductShowcaseNavigation
          onPrevious={() => go(-1)}
          onNext={() => go(1)}
          previousLabel={copy.category.previous}
          nextLabel={copy.category.next}
          disabled={sameCategory.length < 2}
        />
        <div className={`category-product-showcase__slide is-${direction}`} key={product.id}>
          <figure className="category-product-showcase__media product-detail-hero__media">
            <img src={activeImage} alt={product.name} />
          </figure>
          <div className="category-product-showcase__copy">
            <span className="category-product-showcase__category">
              {eyebrow}
              {product.badge && <span className="product-detail-badge">{getProductBadge(product, locale)}</span>}
            </span>
            <h1>{product.name}</h1>
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
                          <button disabled={disabled} aria-disabled={disabled} className={selections[option.name] === value.label ? 'is-active' : ''} onClick={() => setSelections((current) => ({ ...current, [option.name]: value.label }))} type="button" key={value.label}>
                            {value.color && <i style={{ background: value.color }} />}{getOptionValue(value, locale)}
                          </button>
                        ); })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            )}

            <div className="product-detail-buy">
              <div className="quantity-control product-detail-qty" aria-label={copy.detail.quantity}>
                <button type="button" aria-label={copy.detail.decrease} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
                <span>{quantity}</span>
                <button type="button" disabled={Number.isFinite(stockLimit) && quantity >= stockLimit} aria-label={copy.detail.increase} onClick={() => setQuantity((value) => Number.isFinite(stockLimit) ? Math.min(stockLimit, value + 1) : value + 1)}>+</button>
              </div>
              <button className="store-primary-button product-detail-buy__primary" type="button" disabled={unavailable} onClick={handleAdd}>{added ? copy.detail.added : unavailable ? copy.detail.unavailable : copy.detail.add}</button>
              <button className="store-primary-button product-detail-buy__secondary" type="button" disabled={unavailable} onClick={handleBuyNow}>{copy.detail.buyNow}</button>
            </div>
            {added && <Link className="view-cart-link product-detail-cart-link" to="/cart">{copy.detail.viewCart} {locale === 'ar' ? '←' : '→'}</Link>}
          </div>
        </div>
        <span className="category-product-showcase__count">{String(currentIndex + 1).padStart(2, '0')} / {String(sameCategory.length).padStart(2, '0')}</span>
      </section>

      <div className="product-detail-content">
        <section className="product-detail-extras">
          <div className="product-detail-gallery">
            <div className="product-detail-section-head">
              <span className="store-eyebrow">{copy.detail.gallery}</span>
              <h2>{copy.detail.galleryTitle}</h2>
            </div>
            <figure className="product-detail-gallery__preview">
              <img src={activeImage} alt={product.name} />
              {product.badge && <span className="product-detail-badge">{getProductBadge(product, locale)}</span>}
            </figure>
            {gallery.length > 1 && (
              <div className="product-detail-gallery__thumbs" role="tablist" aria-label={`${copy.detail.gallery} ${product.name}`}>
                {gallery.map((image, index) => (
                  <button
                    type="button"
                    className={image === activeImage ? 'is-active' : ''}
                    role="tab"
                    aria-selected={image === activeImage}
                    aria-label={`${product.name} ${copy.detail.imageView} ${index + 1}`}
                    onClick={() => setActiveImage(image)}
                    key={image}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="product-detail-specs">
            <div className="product-detail-section-head">
              <span className="store-eyebrow">{eyebrow}</span>
              <h2>{copy.detail.specs}</h2>
            </div>
            <div className="product-detail-specs__blocks">
              <div className="product-detail-specs__about">
                <h3>{copy.detail.about}</h3>
                <p>{getProductDescription(product, locale)}</p>
              </div>
              <dl className="product-detail-specs__list">
                {specs.map((row) => (
                  <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {productMedia.usageVideo && (
          <section className="product-usage-video" aria-label={copy.detail.howToUse}>
            <div className="product-detail-section-head">
              <span className="store-eyebrow">{copy.detail.howToUse}</span>
              <h2>{copy.detail.howToUse}</h2>
            </div>
            <video
              className="product-usage-video__player"
              src={productMedia.usageVideo}
              poster={productMedia.usageVideoPoster || product.image}
              controls
              playsInline
              preload="metadata"
              aria-label={`${copy.detail.howToUse} — ${product.name}`}
            />
          </section>
        )}
      </div>

      <section className="related-products product-detail-related">
        <div className="product-detail-content">
          <div className="related-products__head"><span className="store-eyebrow">{copy.detail.keep}</span><h2>{copy.detail.related}</h2></div>
          <div className="related-products__track">{related.map((item) => <ProductCard product={item} key={item.id} />)}</div>
        </div>
      </section>
    </div>
  );
}
