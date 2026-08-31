import { useEffect, useMemo, useRef, useState } from 'react';
import ProductShowcaseNavigation from '../components/ProductShowcaseNavigation';
import PageNavigation from '../components/PageNavigation';
import { useCart } from '../context/CartContext';
import {
  collectProductImages,
  getAvailability,
  getCategoryLabel,
  getOptionName,
  getOptionValue,
  getProductBadge,
  getProductDescription,
  getProductName,
} from '../data/products';
import {
  filterGroups,
  getBrand,
  getCategory,
  getPathHeroMedia,
  getProductBySlug,
  getProductMedia,
  getSubcategory,
  getVelvetPathLabel,
  velvetProducts,
} from '../data/velvetCatalog';
import { Link, localizePath, useRouter } from '../routing/Router';
import { useI18n } from '../i18n/I18nContext';
import { availableStock, optionValueUnavailable, selectedVariant } from '../data/inventory';
import { isSiblingDragGesture, shouldNavigateSibling } from '../hooks/siblingCarousel';

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

export default function ProductDetailsPage({ slug }) {
  const product = getProductBySlug(slug);
  const { copy, locale } = useI18n();
  const { navigate } = useRouter();
  const { addItem } = useCart();
  const touchStartX = useRef(null);
  const addedTimer = useRef(null);
  const sliderViewportRef = useRef(null);
  const siblingDrag = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    dragged: false,
    pressedSlug: '',
    capturing: false,
  });

  const images = useMemo(() => collectProductImages(product), [product]);
  const initialSelections = useMemo(
    () => Object.fromEntries((product?.options || []).map((option) => [option.name, option.values[0]?.label || ''])),
    [product],
  );

  const [selections, setSelections] = useState(initialSelections);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [direction, setDirection] = useState('next');
  const [imageIndex, setImageIndex] = useState(0);

  const sameSubcategory = useMemo(() => {
    if (!product?.velvetPath?.subcategoryId) {
      if (!product?.velvetPath) return product ? [product] : [];
      return velvetProducts.filter(
        (item) => item.velvetPath?.brandId === product.velvetPath.brandId
          && item.velvetPath?.categoryId === product.velvetPath.categoryId
          && !item.velvetPath?.subcategoryId,
      );
    }
    return velvetProducts.filter(
      (item) => item.velvetPath?.brandId === product.velvetPath.brandId
        && item.velvetPath?.categoryId === product.velvetPath.categoryId
        && item.velvetPath?.subcategoryId === product.velvetPath.subcategoryId,
    );
  }, [product]);

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  useEffect(() => {
    setSelections(initialSelections);
    setQuantity(1);
    setAdded(false);
    setImageIndex(0);
    setDirection('next');
  }, [product?.id, product?.slug, initialSelections]);

  const activeVariant = selectedVariant(product, selections);
  const stockLimit = availableStock(product, selections);
  const unavailable = product?.inventoryManaged ? stockLimit <= 0 : product?.availability === 'Out of stock';

  useEffect(() => {
    if (Number.isFinite(stockLimit)) setQuantity((value) => Math.max(1, Math.min(stockLimit || 1, value)));
  }, [stockLimit]);

  useEffect(() => {
    if (!product?.slug || sameSubcategory.length < 2) return undefined;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cancelled || siblingDrag.current.active) return;
        const viewport = sliderViewportRef.current;
        if (!viewport) return;
        const activeSlide = viewport.querySelector('.same-subcategory-products__slide.is-active');
        if (!activeSlide) return;
        const paddingLeft = Number.parseFloat(window.getComputedStyle(viewport).paddingLeft) || 0;
        const delta = activeSlide.getBoundingClientRect().left
          - (viewport.getBoundingClientRect().left + paddingLeft);
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const target = Math.min(Math.max(0, viewport.scrollLeft + delta), maxScroll);
        viewport.scrollTo({ left: target, behavior: 'smooth' });
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [product?.slug, sameSubcategory.length]);

  if (!product) {
    return (
      <section className="store-not-found">
        <span className="store-eyebrow">{copy.detail.missingEyebrow}</span>
        <h1>{copy.detail.missing}</h1>
        <Link className="store-primary-button" to="/products">{copy.detail.back}</Link>
      </section>
    );
  }

  const hasGallery = images.length > 1;
  const activeImage = images[imageIndex] || product.image || '';
  const productMedia = getProductMedia(product);
  const pathHero = getPathHeroMedia(product);
  const optionDelta = product.options.reduce((sum, option) => sum + Number(option.values.find((value) => value.label === selections[option.name])?.priceDelta || 0), 0);
  const currentPrice = product.price + optionDelta;
  const optionSummary = product.options.map((option) => getOptionName(option, locale)).join(' · ');
  const brand = product.velvetPath?.brandId ? getBrand(product.velvetPath.brandId) : null;
  const category = product.velvetPath ? getCategory(product.velvetPath.brandId, product.velvetPath.categoryId) : null;
  const subcategory = product.velvetPath?.subcategoryId
    ? getSubcategory(product.velvetPath.brandId, product.velvetPath.categoryId, product.velvetPath.subcategoryId)
    : null;
  const eyebrow = subcategory?.name[locale] || category?.name[locale] || getVelvetPathLabel(product, locale) || getCategoryLabel(product.categoryId, locale);
  const heroTitle = pathHero.name?.[locale] || eyebrow || '';
  const productName = getProductName(product, locale);

  const metres = {
    age: filterGroups.age.find((item) => item.id === product.age),
    skill: filterGroups.skill.find((item) => item.id === product.skill),
  };

  const stepImage = (step) => {
    if (!hasGallery) return;
    setDirection(step > 0 ? 'next' : 'previous');
    setImageIndex((current) => (current + step + images.length) % images.length);
  };

  const openSiblingProduct = (targetSlug, dragged = siblingDrag.current.dragged) => {
    if (!shouldNavigateSibling({ dragged, targetSlug, currentSlug: product.slug })) return;
    setDirection('next');
    navigate(localizePath(`/products/${targetSlug}`, locale), { scroll: false });
  };

  const onSiblingPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const viewport = sliderViewportRef.current;
    if (!viewport) return;
    const slide = event.target.closest('.same-subcategory-products__slide');
    siblingDrag.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      dragged: false,
      pressedSlug: slide?.dataset?.siblingSlug || '',
      capturing: false,
    };
    viewport.classList.add('is-dragging');
  };

  const onSiblingPointerMove = (event) => {
    if (!siblingDrag.current.active) return;
    const viewport = sliderViewportRef.current;
    if (!viewport) return;
    if (isSiblingDragGesture(
      siblingDrag.current.startX,
      siblingDrag.current.startY,
      event.clientX,
      event.clientY,
    )) {
      siblingDrag.current.dragged = true;
      if (!siblingDrag.current.capturing) {
        siblingDrag.current.capturing = true;
        try { viewport.setPointerCapture(event.pointerId); } catch { /* ignore */ }
      }
      const delta = event.clientX - siblingDrag.current.startX;
      viewport.scrollLeft = siblingDrag.current.scrollLeft - delta;
    }
  };

  const onSiblingPointerUp = (event) => {
    const viewport = sliderViewportRef.current;
    const state = siblingDrag.current;
    if (state.active && state.pressedSlug) {
      openSiblingProduct(state.pressedSlug, state.dragged);
    }
    if (state.capturing && viewport) {
      try { viewport.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    }
    siblingDrag.current = {
      active: false,
      startX: 0,
      startY: 0,
      scrollLeft: 0,
      dragged: false,
      pressedSlug: '',
      capturing: false,
    };
    viewport?.classList.remove('is-dragging');
  };

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

  const onTouchStart = (event) => {
    touchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
  };

  const onTouchEnd = (event) => {
    if (touchStartX.current == null || !hasGallery) return;
    const endX = event.changedTouches?.[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    stepImage(delta < 0 ? 1 : -1);
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
  if (category) {
    detailBreadcrumbs.push({
      label: category.name[locale],
      to: `/brands/${product.velvetPath.brandId}/category/${product.velvetPath.categoryId}`,
    });
  }
  if (subcategory) detailBreadcrumbs.push({ label: subcategory.name[locale] });
  detailBreadcrumbs.push({ label: productName });

  const detailFallback = product.velvetPath
    ? `/products?brand=${product.velvetPath.brandId}&category=${product.velvetPath.categoryId}${product.velvetPath.subcategoryId ? `&subcategory=${product.velvetPath.subcategoryId}` : ''}`
    : '/products';

  return (
    <div className="product-detail-page">
      <PageNavigation fallbackPath={detailFallback} breadcrumbs={detailBreadcrumbs} />

      {pathHero.source === 'subcategory' ? (
        <section className="category-hero" aria-label={copy.detail.pathHero}>
          {pathHero.video ? (
            <video className="category-hero__media" src={pathHero.video} poster={pathHero.image || undefined} autoPlay muted loop playsInline />
          ) : pathHero.image ? (
            <img className="category-hero__media" src={pathHero.image} alt="" />
          ) : (
            <div className="category-hero__media product-path-hero__fallback" aria-hidden="true" />
          )}
          <div className="category-hero__shade" aria-hidden="true" />
          <div className="category-hero__title">
            {brand && <span>{brand.name[locale]}</span>}
            {heroTitle && <h1>{heroTitle}</h1>}
          </div>
        </section>
      ) : (
        <section className={`product-path-hero ${pathHero.image || pathHero.video ? 'has-media' : 'is-fallback'}`} aria-label={copy.detail.pathHero}>
          {pathHero.video ? (
            <video className="product-path-hero__media" src={pathHero.video} poster={pathHero.image || undefined} autoPlay muted loop playsInline />
          ) : pathHero.image ? (
            <img className="product-path-hero__media" src={pathHero.image} alt="" />
          ) : (
            <div className="product-path-hero__fallback" aria-hidden="true" />
          )}
          <div className="product-path-hero__shade" aria-hidden="true" />
          <div className="product-path-hero__copy">
            {brand && <span>{brand.name[locale]}</span>}
            {heroTitle && <h1>{heroTitle}</h1>}
          </div>
        </section>
      )}

      <section className="category-product-showcase category-product-showcase--detail" aria-label={productName}>
        {hasGallery && (
          <ProductShowcaseNavigation
            onPrevious={() => stepImage(-1)}
            onNext={() => stepImage(1)}
            previousLabel={copy.detail.previousImage}
            nextLabel={copy.detail.nextImage}
          />
        )}
        <div
          className={`category-product-showcase__slide is-${direction}`}
          key={product.id}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="product-detail-focal">
            <figure className="category-product-showcase__media product-detail-hero__media">
              <img key={activeImage} className="product-detail-focal__image" src={activeImage} alt={productName} />
            </figure>
          </div>
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
                              disabled={disabled}
                              aria-disabled={disabled}
                              className={selections[option.name] === value.label ? 'is-active' : ''}
                              onClick={() => setSelections((current) => ({ ...current, [option.name]: value.label }))}
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
                <button type="button" aria-label={copy.detail.decrease} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
                <span>{quantity}</span>
                <button type="button" disabled={Number.isFinite(stockLimit) && quantity >= stockLimit} aria-label={copy.detail.increase} onClick={() => setQuantity((value) => (Number.isFinite(stockLimit) ? Math.min(stockLimit, value + 1) : value + 1))}>+</button>
              </div>
              <button className="store-primary-button product-detail-buy__primary" type="button" disabled={unavailable} onClick={handleAdd}>{added ? copy.detail.added : unavailable ? copy.detail.unavailable : copy.detail.add}</button>
              <button className="store-primary-button product-detail-buy__secondary" type="button" disabled={unavailable} onClick={handleBuyNow}>{copy.detail.buyNow}</button>
            </div>
            {added && <Link className="view-cart-link product-detail-cart-link" to="/cart">{copy.detail.viewCart} {locale === 'ar' ? '←' : '→'}</Link>}
          </div>
        </div>
      </section>

      {sameSubcategory.length > 1 && (
        <section className="same-subcategory-products" aria-label={copy.detail.sameSubcategory}>
          <div
            className="same-subcategory-products__viewport"
            ref={sliderViewportRef}
            onPointerDown={onSiblingPointerDown}
            onPointerMove={onSiblingPointerMove}
            onPointerUp={onSiblingPointerUp}
            onPointerCancel={onSiblingPointerUp}
          >
            <div className="same-subcategory-products__track">
              {sameSubcategory.map((item) => {
                const isActive = item.slug === product.slug;
                return (
                  <button
                    type="button"
                    className={`same-subcategory-products__slide ${isActive ? 'is-active' : ''}`}
                    key={item.id || item.slug}
                    data-sibling-slug={item.slug}
                    aria-current={isActive ? 'true' : undefined}
                    aria-label={getProductName(item, locale)}
                  >
                    <img src={item.image} alt="" draggable={false} />
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="product-detail-content">
        <section className="product-detail-extras product-detail-extras--specs-only">
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
          <section className="product-usage-video" aria-label={copy.detail.howToUse} key={`usage-${product.slug}`}>
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
              aria-label={`${copy.detail.howToUse} — ${productName}`}
            />
          </section>
        )}
      </div>
    </div>
  );
}
