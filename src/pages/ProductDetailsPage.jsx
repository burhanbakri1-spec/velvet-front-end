import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProductCard from '../components/ProductCard';
import ProductDetailSlide from '../components/ProductDetailSlide';
import ProductShowcaseNavigation from '../components/ProductShowcaseNavigation';
import PageNavigation from '../components/PageNavigation';
import { useCart } from '../context/CartContext';
import {
  getAvailability,
  getCategoryLabel,
  getCustomerFacingSelectionLabels,
  getCustomerFacingVariantLabels,
  getProductDescription,
  getProductName,
  resolveProductImages,
} from '../data/products';
import {
  filterGroups,
  getBrand,
  getCategory,
  getFilterGroup,
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
  getRelatedPageSize,
  getRelatedPageSlice,
  getRelatedProducts,
  normalizeRelatedPageIndex,
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

  const relatedProducts = useMemo(
    () => getRelatedProducts(routeProduct, velvetProducts),
    [routeProduct],
  );

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
  const [relatedPage, setRelatedPage] = useState(0);
  const [relatedPageSize, setRelatedPageSize] = useState(() => (
    typeof window === 'undefined' ? 4 : getRelatedPageSize(window.innerWidth)
  ));

  const images = useMemo(
    () => resolveProductImages(routeProduct, selections),
    [routeProduct, selections],
  );
  const hasGallery = images.length > 1;
  const isTransitioning = Boolean(transition);
  const rtl = locale === 'ar';
  const activeImage = images[imageIndex] || routeProduct?.image || '';

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  useEffect(() => {
    setSelections(initialSelections);
    setQuantity(1);
    setAdded(false);
    setImageIndex(0);
    setTransition(null);
    setSlideAnimating(false);
    setRelatedPage(0);
  }, [routeProduct?.id, routeProduct?.slug, initialSelections]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updatePageSize = () => {
      setRelatedPageSize(getRelatedPageSize(window.innerWidth));
    };
    updatePageSize();
    window.addEventListener('resize', updatePageSize);
    return () => window.removeEventListener('resize', updatePageSize);
  }, []);

  useEffect(() => {
    setRelatedPage((current) => normalizeRelatedPageIndex(current, relatedProducts.length, relatedPageSize));
  }, [relatedProducts.length, relatedPageSize]);

  useEffect(() => {
    setImageIndex(0);
    setTransition(null);
    setSlideAnimating(false);
  }, [selections]);

  useEffect(() => {
    setImageIndex((current) => {
      if (!images.length) return 0;
      return Math.min(current, images.length - 1);
    });
  }, [images]);

  const stockLimit = availableStock(routeProduct, selections);
  const unavailable = routeProduct?.inventoryManaged ? stockLimit <= 0 : routeProduct?.availability === 'Out of stock';
  const activeVariant = selectedVariant(routeProduct, selections);

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
  }, [routeProduct?.slug, imageIndex, hasGallery, images]);

  const resolveEyebrow = useCallback((item) => {
    if (!item) return '';
    const brand = item.velvetPath?.brandId ? getBrand(item.velvetPath.brandId) : null;
    const category = item.velvetPath ? getCategory(item.velvetPath.brandId, item.velvetPath.categoryId) : null;
    const subcategory = item.velvetPath?.subcategoryId
      ? getSubcategory(item.velvetPath.brandId, item.velvetPath.categoryId, item.velvetPath.subcategoryId)
      : null;
    return subcategory?.name[locale] || category?.name[locale] || getVelvetPathLabel(item, locale) || getCategoryLabel(item.categoryId, locale);
  }, [locale]);

  const beginImageTransition = useCallback((direction) => {
    if (!hasGallery || isTransitioning || !routeProduct) return;
    const step = direction === 'next' ? 1 : -1;
    const nextIndex = (imageIndex + step + images.length) % images.length;
    if (nextIndex === imageIndex) return;

    const viewport = switcherViewportRef.current;
    if (viewport) {
      viewport.style.setProperty('--product-switcher-height', `${viewport.offsetHeight}px`);
    }

    setTransition({ direction, fromIndex: imageIndex, toIndex: nextIndex });
    setSlideAnimating(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setSlideAnimating(true));
    });
    window.setTimeout(() => {
      setImageIndex(nextIndex);
      setTransition(null);
      setSlideAnimating(false);
      if (viewport) viewport.style.removeProperty('--product-switcher-height');
    }, PRODUCT_SWITCH_DURATION_MS);
  }, [hasGallery, isTransitioning, routeProduct, imageIndex, images.length]);

  const handleAdd = (event) => {
    event.preventDefault();
    if (unavailable || !routeProduct) return;
    const variant = selectedVariant(routeProduct, selections);
    addItem(routeProduct, selections, Math.min(quantity, stockLimit), activeImage, variant);
    setAdded(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), 1800);
  };

  const handleBuyNow = (event) => {
    event.preventDefault();
    if (unavailable || !routeProduct) return;
    const variant = selectedVariant(routeProduct, selections);
    addItem(routeProduct, selections, Math.min(quantity, stockLimit), activeImage, variant);
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
    if (!hasGallery) return;
    switchTouchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
  };

  const onSwitcherTouchEnd = (event) => {
    if (!hasGallery || switchTouchStartX.current == null || isTransitioning) return;
    const endX = event.changedTouches?.[0]?.clientX ?? switchTouchStartX.current;
    const delta = endX - switchTouchStartX.current;
    switchTouchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    beginImageTransition(delta < 0 ? 'next' : 'previous');
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
  const brand = routeProduct.velvetPath?.brandId ? getBrand(routeProduct.velvetPath.brandId) : null;
  const category = routeProduct.velvetPath ? getCategory(routeProduct.velvetPath.brandId, routeProduct.velvetPath.categoryId) : null;
  const subcategory = routeProduct.velvetPath?.subcategoryId
    ? getSubcategory(routeProduct.velvetPath.brandId, routeProduct.velvetPath.categoryId, routeProduct.velvetPath.subcategoryId)
    : null;
  const eyebrow = resolveEyebrow(routeProduct);
  const productName = getProductName(routeProduct, locale);

  const metres = {
    age: getFilterGroup('age').find((item) => item.id === routeProduct.age)
      || filterGroups.age.find((item) => item.id === routeProduct.age),
    skill: getFilterGroup('skill').find((item) => item.id === routeProduct.skill)
      || filterGroups.skill.find((item) => item.id === routeProduct.skill),
  };

  const specs = [];
  if (brand) specs.push({ label: copy.shop.brand, value: brand.name[locale] });
  if (eyebrow) specs.push({ label: copy.shop.category, value: eyebrow });
  if (routeProduct.manufacturer) specs.push({ label: copy.shop.manufacturer, value: routeProduct.manufacturer });
  if (metres.age) specs.push({ label: copy.detail.age, value: metres.age.name[locale] });
  if (metres.skill) specs.push({ label: copy.detail.skill, value: metres.skill.name[locale] });
  const selectionLabels = getCustomerFacingSelectionLabels(routeProduct, selections, locale);
  const variantLabels = getCustomerFacingVariantLabels(activeVariant, locale);
  const optionSpecValue = (selectionLabels.length ? selectionLabels : variantLabels).join(' · ');
  if (optionSpecValue) {
    specs.push({
      label: copy.category.variants,
      value: optionSpecValue,
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

  const slideProps = {
    locale,
    copy,
    product: routeProduct,
    eyebrow,
    selections,
    quantity,
    added,
    unavailable,
    stockLimit,
    interactive: !isTransitioning,
    showMedia: true,
    onSelections: setSelections,
    onQuantity: setQuantity,
    onAdd: handleAdd,
    onBuyNow: handleBuyNow,
  };

  const slideStyle = (direction, role, animating) => {
    const { start, end } = getProductSlidePercent(direction, role, rtl);
    const percent = animating ? end : start;
    return { transform: `translate3d(${percent}%, 0, 0)` };
  };

  return (
    <div className="product-detail-page">
      <PageNavigation fallbackPath={detailFallback} breadcrumbs={detailBreadcrumbs} />

      <section
        className="category-product-showcase category-product-showcase--detail"
        aria-label={productName}
        data-product-section="gallery"
      >
        {hasGallery && (
          <ProductShowcaseNavigation
            onPrevious={() => beginImageTransition('previous')}
            onNext={() => beginImageTransition('next')}
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
                  {...slideProps}
                  interactive={false}
                  imageSrc={images[transition.fromIndex] || activeImage}
                />
              </div>
              <div
                className="product-switcher-slide product-switcher-slide--incoming"
                style={slideStyle(transition.direction, 'incoming', slideAnimating)}
              >
                <ProductDetailSlide
                  {...slideProps}
                  interactive={false}
                  imageSrc={images[transition.toIndex] || activeImage}
                />
              </div>
            </>
          ) : (
            <div className="product-switcher-slide product-switcher-slide--active">
              <ProductDetailSlide
                {...slideProps}
                imageSrc={activeImage}
              />
            </div>
          )}
        </div>
      </section>

      {hasGallery && (
        <section
          className="same-subcategory-products product-image-gallery product-image-gallery--compact"
          aria-label={copy.detail.galleryTitle}
          data-product-section="thumbs"
        >
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

      <div className="product-detail-content" data-product-section="commerce">
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
                  <div key={`${row.label}-${row.value}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>
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

      {relatedProducts.length > 0 && (
        <section className="product-related" aria-label={copy.detail.related} data-product-section="related">
          <div className="product-related__toolbar">
            <div className="product-detail-section-head product-related__head">
              <span className="store-eyebrow">{copy.detail.sameSubcategory}</span>
              <h2>{copy.detail.related}</h2>
            </div>
            {relatedProducts.length > relatedPageSize && (
              <div className="product-related__nav" aria-label={copy.detail.related}>
                <button
                  type="button"
                  className="product-related__nav-button"
                  aria-label={copy.category.previous}
                  onClick={() => setRelatedPage((current) => normalizeRelatedPageIndex(
                    current - 1,
                    relatedProducts.length,
                    relatedPageSize,
                  ))}
                >
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  type="button"
                  className="product-related__nav-button"
                  aria-label={copy.category.next}
                  onClick={() => setRelatedPage((current) => normalizeRelatedPageIndex(
                    current + 1,
                    relatedProducts.length,
                    relatedPageSize,
                  ))}
                >
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </div>
          <div
            className="product-related__grid shop-products"
            style={{ '--related-columns': relatedPageSize }}
            data-related-page-size={relatedPageSize}
          >
            {getRelatedPageSlice(relatedProducts, relatedPage, relatedPageSize).map((product) => (
              <ProductCard key={product.id || product.slug} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
