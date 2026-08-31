import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProductDetailSlide from '../components/ProductDetailSlide';
import ProductShowcaseNavigation from '../components/ProductShowcaseNavigation';
import PageNavigation from '../components/PageNavigation';
import { useCart } from '../context/CartContext';
import {
  collectProductImages,
  getAvailability,
  getCategoryLabel,
  getOptionName,
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
import { availableStock, selectedVariant } from '../data/inventory';
import { isSiblingDragGesture } from '../hooks/siblingCarousel';
import {
  buildInitialSelections,
  getProductSlidePercent,
  getSameSubcategoryProducts,
  getSiblingProduct,
  PRODUCT_SWITCH_DURATION_MS,
} from '../hooks/productSiblings';

export default function ProductDetailsPage({ slug }) {
  const routeProduct = getProductBySlug(slug);
  const { copy, locale } = useI18n();
  const { navigate } = useRouter();
  const { addItem } = useCart();
  const addedTimer = useRef(null);
  const galleryViewportRef = useRef(null);
  const switcherViewportRef = useRef(null);
  const galleryDrag = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    dragged: false,
    capturing: false,
  });
  const switchTouchStartX = useRef(null);

  const sameSubcategory = useMemo(
    () => getSameSubcategoryProducts(routeProduct, velvetProducts),
    [routeProduct],
  );

  const images = useMemo(() => collectProductImages(routeProduct), [routeProduct]);
  const initialSelections = useMemo(
    () => buildInitialSelections(routeProduct),
    [routeProduct],
  );

  const [selections, setSelections] = useState(initialSelections);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [transition, setTransition] = useState(null);
  const [slideAnimating, setSlideAnimating] = useState(false);

  const hasSiblings = sameSubcategory.length > 1;
  const hasGallery = images.length > 1;
  const isTransitioning = Boolean(transition);
  const rtl = locale === 'ar';

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  useEffect(() => {
    setSelections(initialSelections);
    setQuantity(1);
    setAdded(false);
    setImageIndex(0);
    setTransition(null);
    setSlideAnimating(false);
  }, [routeProduct?.id, routeProduct?.slug, initialSelections]);

  const stockLimit = availableStock(routeProduct, selections);
  const unavailable = routeProduct?.inventoryManaged ? stockLimit <= 0 : routeProduct?.availability === 'Out of stock';

  useEffect(() => {
    if (Number.isFinite(stockLimit)) setQuantity((value) => Math.max(1, Math.min(stockLimit || 1, value)));
  }, [stockLimit]);

  useEffect(() => {
    if (!routeProduct?.slug || !hasGallery) return undefined;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cancelled || galleryDrag.current.active) return;
        const viewport = galleryViewportRef.current;
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
  }, [routeProduct?.slug, imageIndex, hasGallery]);

  const resolveEyebrow = useCallback((item) => {
    if (!item) return '';
    const brand = item.velvetPath?.brandId ? getBrand(item.velvetPath.brandId) : null;
    const category = item.velvetPath ? getCategory(item.velvetPath.brandId, item.velvetPath.categoryId) : null;
    const subcategory = item.velvetPath?.subcategoryId
      ? getSubcategory(item.velvetPath.brandId, item.velvetPath.categoryId, item.velvetPath.subcategoryId)
      : null;
    return subcategory?.name[locale] || category?.name[locale] || getVelvetPathLabel(item, locale) || getCategoryLabel(item.categoryId, locale);
  }, [locale]);

  const completeTransition = useCallback(() => {
    if (!transition) return;
    const targetSlug = transition.incoming.slug;
    setSlideAnimating(false);
    setTransition(null);
    navigate(localizePath(`/products/${targetSlug}`, locale), { scroll: false });
  }, [transition, navigate, locale]);

  useEffect(() => {
    if (!transition || slideAnimating) return undefined;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setSlideAnimating(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [transition, slideAnimating]);

  useEffect(() => {
    if (!transition || !slideAnimating) return undefined;
    const timer = window.setTimeout(completeTransition, PRODUCT_SWITCH_DURATION_MS + 40);
    return () => window.clearTimeout(timer);
  }, [transition, slideAnimating, completeTransition]);

  const beginSiblingTransition = (direction) => {
    if (!routeProduct || isTransitioning || !hasSiblings) return;
    const incoming = getSiblingProduct(routeProduct, sameSubcategory, direction);
    if (!incoming || incoming.slug === routeProduct.slug) return;
    const viewport = switcherViewportRef.current;
    if (viewport) {
      viewport.style.setProperty('--product-switcher-height', `${viewport.offsetHeight}px`);
    }
    setSlideAnimating(false);
    setTransition({ direction, outgoing: routeProduct, incoming });
  };

  const buildSlideState = (item, imageIdx, itemSelections, itemQuantity, itemAdded) => {
    const itemImages = collectProductImages(item);
    const imageSrc = itemImages[imageIdx] || item.image || '';
    const itemStockLimit = availableStock(item, itemSelections);
    const itemUnavailable = item.inventoryManaged ? itemStockLimit <= 0 : item.availability === 'Out of stock';
    return {
      product: item,
      eyebrow: resolveEyebrow(item),
      imageSrc,
      selections: itemSelections,
      quantity: itemQuantity,
      added: itemAdded,
      unavailable: itemUnavailable,
      stockLimit: itemStockLimit,
    };
  };

  const handleAdd = (event, product = routeProduct, itemSelections = selections, itemQuantity = quantity, imageSrc = images[imageIndex] || product?.image || '') => {
    event.preventDefault();
    const itemStockLimit = availableStock(product, itemSelections);
    const itemUnavailable = product.inventoryManaged ? itemStockLimit <= 0 : product.availability === 'Out of stock';
    if (itemUnavailable) return;
    const variant = selectedVariant(product, itemSelections);
    addItem(product, itemSelections, Math.min(itemQuantity, itemStockLimit), imageSrc, variant);
    setAdded(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), 1800);
  };

  const handleBuyNow = (event, product = routeProduct, itemSelections = selections, itemQuantity = quantity, imageSrc = images[imageIndex] || product?.image || '') => {
    event.preventDefault();
    const itemStockLimit = availableStock(product, itemSelections);
    const itemUnavailable = product.inventoryManaged ? itemStockLimit <= 0 : product.availability === 'Out of stock';
    if (itemUnavailable) return;
    const variant = selectedVariant(product, itemSelections);
    addItem(product, itemSelections, Math.min(itemQuantity, itemStockLimit), imageSrc, variant);
    navigate(localizePath('/checkout', locale));
  };

  const onGalleryPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const viewport = galleryViewportRef.current;
    if (!viewport) return;
    galleryDrag.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      dragged: false,
      capturing: false,
    };
    viewport.classList.add('is-dragging');
  };

  const onGalleryPointerMove = (event) => {
    if (!galleryDrag.current.active) return;
    const viewport = galleryViewportRef.current;
    if (!viewport) return;
    if (isSiblingDragGesture(
      galleryDrag.current.startX,
      galleryDrag.current.startY,
      event.clientX,
      event.clientY,
    )) {
      galleryDrag.current.dragged = true;
      if (!galleryDrag.current.capturing) {
        galleryDrag.current.capturing = true;
        try { viewport.setPointerCapture(event.pointerId); } catch { /* ignore */ }
      }
      const delta = event.clientX - galleryDrag.current.startX;
      viewport.scrollLeft = galleryDrag.current.scrollLeft - delta;
    }
  };

  const onGalleryPointerUp = (event) => {
    const viewport = galleryViewportRef.current;
    const state = galleryDrag.current;
    if (state.capturing && viewport) {
      try { viewport.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    }
    galleryDrag.current = {
      active: false,
      startX: 0,
      startY: 0,
      scrollLeft: 0,
      dragged: false,
      capturing: false,
    };
    viewport?.classList.remove('is-dragging');
    window.setTimeout(() => { galleryDrag.current.dragged = false; }, 0);
  };

  const onSwitcherTouchStart = (event) => {
    if (!hasSiblings) return;
    switchTouchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
  };

  const onSwitcherTouchEnd = (event) => {
    if (!hasSiblings || switchTouchStartX.current == null || isTransitioning) return;
    const endX = event.changedTouches?.[0]?.clientX ?? switchTouchStartX.current;
    const delta = endX - switchTouchStartX.current;
    switchTouchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    beginSiblingTransition(delta < 0 ? 'next' : 'previous');
  };

  if (!routeProduct) {
    return (
      <section className="store-not-found">
        <span className="store-eyebrow">{copy.detail.missingEyebrow}</span>
        <h1>{copy.detail.missing}</h1>
        <Link className="store-primary-button" to="/products">{copy.detail.back}</Link>
      </section>
    );
  }

  const productMedia = getProductMedia(routeProduct);
  const pathHero = getPathHeroMedia(routeProduct);
  const brand = routeProduct.velvetPath?.brandId ? getBrand(routeProduct.velvetPath.brandId) : null;
  const category = routeProduct.velvetPath ? getCategory(routeProduct.velvetPath.brandId, routeProduct.velvetPath.categoryId) : null;
  const subcategory = routeProduct.velvetPath?.subcategoryId
    ? getSubcategory(routeProduct.velvetPath.brandId, routeProduct.velvetPath.categoryId, routeProduct.velvetPath.subcategoryId)
    : null;
  const eyebrow = resolveEyebrow(routeProduct);
  const heroTitle = pathHero.name?.[locale] || eyebrow || '';
  const productName = getProductName(routeProduct, locale);

  const metres = {
    age: filterGroups.age.find((item) => item.id === routeProduct.age),
    skill: filterGroups.skill.find((item) => item.id === routeProduct.skill),
  };

  const specs = [];
  if (brand) specs.push({ label: copy.shop.brand, value: brand.name[locale] });
  if (eyebrow) specs.push({ label: copy.shop.category, value: eyebrow });
  if (routeProduct.manufacturer) specs.push({ label: copy.shop.manufacturer, value: routeProduct.manufacturer });
  if (metres.age) specs.push({ label: copy.detail.age, value: metres.age.name[locale] });
  if (metres.skill) specs.push({ label: copy.detail.skill, value: metres.skill.name[locale] });
  if (routeProduct.options.length > 0) {
    specs.push({
      label: copy.category.variants,
      value: routeProduct.options.map((option) => getOptionName(option, locale)).join(' · '),
    });
  }
  specs.push({ label: copy.detail.stock, value: getAvailability(routeProduct, locale) });

  const detailBreadcrumbs = [{ label: copy.meta.home, to: '/' }];
  if (brand) detailBreadcrumbs.push({ label: brand.name[locale], to: `/brands/${routeProduct.velvetPath.brandId}` });
  if (category) {
    detailBreadcrumbs.push({
      label: category.name[locale],
      to: `/brands/${routeProduct.velvetPath.brandId}/category/${routeProduct.velvetPath.categoryId}`,
    });
  }
  if (subcategory) detailBreadcrumbs.push({ label: subcategory.name[locale] });
  detailBreadcrumbs.push({ label: productName });

  const detailFallback = routeProduct.velvetPath
    ? `/products?brand=${routeProduct.velvetPath.brandId}&category=${routeProduct.velvetPath.categoryId}${routeProduct.velvetPath.subcategoryId ? `&subcategory=${routeProduct.velvetPath.subcategoryId}` : ''}`
    : '/products';

  const activeSlideState = buildSlideState(routeProduct, imageIndex, selections, quantity, added);
  const outgoingState = transition ? buildSlideState(
    transition.outgoing,
    imageIndex,
    selections,
    quantity,
    added,
  ) : null;
  const incomingState = transition ? buildSlideState(
    transition.incoming,
    0,
    buildInitialSelections(transition.incoming),
    1,
    false,
  ) : null;

  const slideStyle = (direction, role, animating) => {
    const { start, end } = getProductSlidePercent(direction, role, rtl);
    const percent = animating ? end : start;
    return { transform: `translate3d(${percent}%, 0, 0)` };
  };

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
        {hasSiblings && (
          <ProductShowcaseNavigation
            onPrevious={() => beginSiblingTransition('previous')}
            onNext={() => beginSiblingTransition('next')}
            previousLabel={copy.detail.previousImage}
            nextLabel={copy.detail.nextImage}
            disabled={isTransitioning}
          />
        )}
        <div
          ref={switcherViewportRef}
          className={`product-switcher-viewport${isTransitioning ? ' is-transitioning' : ''}${transition ? ` is-${transition.direction}` : ''}`}
          onTouchStart={onSwitcherTouchStart}
          onTouchEnd={onSwitcherTouchEnd}
        >
          {transition ? (
            <>
              <div
                className="product-switcher-slide product-switcher-slide--outgoing"
                style={slideStyle(transition.direction, 'outgoing', slideAnimating)}
              >
                <ProductDetailSlide
                  locale={locale}
                  copy={copy}
                  interactive={false}
                  onSelections={setSelections}
                  onQuantity={setQuantity}
                  onAdd={(event) => handleAdd(event, outgoingState.product, outgoingState.selections, outgoingState.quantity, outgoingState.imageSrc)}
                  onBuyNow={(event) => handleBuyNow(event, outgoingState.product, outgoingState.selections, outgoingState.quantity, outgoingState.imageSrc)}
                  {...outgoingState}
                />
              </div>
              <div
                className="product-switcher-slide product-switcher-slide--incoming"
                style={slideStyle(transition.direction, 'incoming', slideAnimating)}
              >
                <ProductDetailSlide
                  locale={locale}
                  copy={copy}
                  interactive={false}
                  onSelections={setSelections}
                  onQuantity={setQuantity}
                  onAdd={(event) => handleAdd(event, incomingState.product, incomingState.selections, incomingState.quantity, incomingState.imageSrc)}
                  onBuyNow={(event) => handleBuyNow(event, incomingState.product, incomingState.selections, incomingState.quantity, incomingState.imageSrc)}
                  {...incomingState}
                />
              </div>
            </>
          ) : (
            <div className="product-switcher-slide product-switcher-slide--active">
              <ProductDetailSlide
                locale={locale}
                copy={copy}
                interactive={!isTransitioning}
                onSelections={setSelections}
                onQuantity={setQuantity}
                onAdd={(event) => handleAdd(event)}
                onBuyNow={(event) => handleBuyNow(event)}
                {...activeSlideState}
              />
            </div>
          )}
        </div>
      </section>

      {hasGallery && (
        <section className="same-subcategory-products product-image-gallery" aria-label={copy.detail.galleryTitle}>
          <div
            className="same-subcategory-products__viewport"
            ref={galleryViewportRef}
            onPointerDown={onGalleryPointerDown}
            onPointerMove={onGalleryPointerMove}
            onPointerUp={onGalleryPointerUp}
            onPointerCancel={onGalleryPointerUp}
          >
            <div className="same-subcategory-products__track">
              {images.map((image, index) => {
                const isActive = index === imageIndex;
                return (
                  <button
                    type="button"
                    className={`same-subcategory-products__slide ${isActive ? 'is-active' : ''}`}
                    key={`${routeProduct.slug}-${image}-${index}`}
                    aria-current={isActive ? 'true' : undefined}
                    aria-label={`${productName} image ${index + 1}`}
                    onClick={() => {
                      if (!galleryDrag.current.dragged && !isTransitioning) setImageIndex(index);
                    }}
                  >
                    <img src={image} alt="" draggable={false} />
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
                <p>{getProductDescription(routeProduct, locale)}</p>
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
          <section className="product-usage-video" aria-label={copy.detail.howToUse} key={`usage-${routeProduct.slug}`}>
            <div className="product-detail-section-head">
              <span className="store-eyebrow">{copy.detail.howToUse}</span>
              <h2>{copy.detail.howToUse}</h2>
            </div>
            <video
              className="product-usage-video__player"
              src={productMedia.usageVideo}
              poster={productMedia.usageVideoPoster || routeProduct.image}
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
