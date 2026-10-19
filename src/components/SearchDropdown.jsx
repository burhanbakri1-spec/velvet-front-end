import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { localizePath, useRouter } from '../routing/Router';
import { getProductName, getCustomerFacingOptions } from '../data/products';
import { filterProducts, getProductBySlug } from '../data/velvetCatalog';
import { formatPrice } from '../data/currency';
import { useCart } from '../context/CartContext';
import { productStock } from '../data/inventory';

const MAX_RESULTS = 8;

export default function SearchDropdown({ query, setQuery }) {
  const { copy, locale } = useI18n();
  const { navigate } = useRouter();
  const { addItem } = useCart();
  const rootRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [totalMatchCount, setTotalMatchCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [quickAdded, setQuickAdded] = useState(null); // product.slug that was just added

  // Live filter on every query change (stays on page while typing)
  useEffect(() => {
    const trimmed = String(query || '').trim();
    if (!trimmed) {
      setProducts([]);
      setTotalMatchCount(0);
      return;
    }
    const results = filterProducts({ search: trimmed.toLowerCase() });
    setTotalMatchCount(results.length);
    setProducts(results.slice(0, MAX_RESULTS));
  }, [query]);

  // Typing again reopens the dropdown
  useEffect(() => {
    setDismissed(false);
  }, [query]);

  // Close on Escape / outside click (keeps query, hides dropdown)
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDismissed(true);
    };
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setDismissed(true);
      }
    };
    const onFocusIn = (event) => {
      const target = event.target;
      if (target && typeof target.closest === 'function' && target.closest('.header-search')) {
        if (String(query || '').trim()) setDismissed(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [setQuery, query]);

  const goSearchResults = () => {
    const q = String(query || '').trim();
    if (!q) return;
    navigate(localizePath(`/products?search=${encodeURIComponent(q)}`, locale));
  };

  const goProduct = (slug) => {
    if (!getProductBySlug(slug)) return;
    navigate(localizePath(`/products/${slug}`, locale));
  };

  const displayName = (product) => getProductName(product, locale);
  const displayImage = (product) => product.images?.[0] || product.image || '';

  // Check if product has customer-facing options that require selection
  const hasRequiredOptions = (product) => {
    const facingOptions = getCustomerFacingOptions(product);
    return facingOptions.length > 0;
  };

  // Check if product is available (has stock)
  const isAvailable = (product) => {
    return productStock(product) > 0;
  };

  const handleQuickAdd = (event, product) => {
    event.preventDefault();
    event.stopPropagation(); // Prevent row navigation

    if (!isAvailable(product)) return;

    const options = getCustomerFacingOptions(product);
    if (options.length > 0) {
      // Product has required variants/options - navigate to product details for selection
      goProduct(product.slug);
      return;
    }

    // Normal product - add to cart immediately
    addItem(product, {}, 1, product.image);
    setQuickAdded(product.slug);
    // Clear quick added state after brief delay
    setTimeout(() => setQuickAdded(null), 1500);
    // Keep dropdown open (don't call setDismissed)
  };

  const trimmed = String(query || '').trim();
  if (!trimmed || dismissed) return null;

  return (
    <div
      ref={rootRef}
      className="search-dropdown"
      role="listbox"
      aria-label={copy.header.searchLabel}
    >
      {products.length === 0 ? (
        <div className="search-dropdown__empty">
          <p className="search-dropdown__empty-title">
            {copy.products.noSearchResults || copy.products.emptyTitle || 'No products found.'}
          </p>
          <p className="search-dropdown__empty-body">
            {copy.products.emptyBody}
          </p>
        </div>
      ) : (
        <div className="search-dropdown__results">
          {products.map((product) => {
            const isJustAdded = quickAdded === product.slug;
            const unavailable = !isAvailable(product);
            const needsOptions = hasRequiredOptions(product);
            return (
              <div
                key={product.slug}
                className={`search-dropdown__result-row${isJustAdded ? ' search-dropdown__result-row--added' : ''}`}
              >
                <button
                  type="button"
                  className="search-dropdown__result"
                  onClick={() => goProduct(product.slug)}
                  disabled={isJustAdded}
                >
                  <img
                    className="search-dropdown__result-image"
                    src={displayImage(product)}
                    alt=""
                  />
                  <span className="search-dropdown__result-body">
                    <span className="search-dropdown__result-name">{displayName(product)}</span>
                    <span className="search-dropdown__result-price">{formatPrice(product.price || 0)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`search-dropdown__quick-add${unavailable ? ' search-dropdown__quick-add--disabled' : ''}${needsOptions ? ' search-dropdown__quick-add--has-options' : ''}${isJustAdded ? ' search-dropdown__quick-add--added' : ''}`}
                  onClick={(event) => handleQuickAdd(event, product)}
                  disabled={unavailable || isJustAdded}
                  aria-label={unavailable
                    ? copy.detail.unavailable
                    : needsOptions
                      ? copy.detail.viewProduct
                      : isJustAdded
                        ? copy.detail.added
                        : copy.detail.add}
                >
                  {isJustAdded ? (
                    <span className="search-dropdown__quick-add-icon" aria-hidden="true">✓</span>
                  ) : needsOptions ? (
                    <span className="search-dropdown__quick-add-icon" aria-hidden="true">→</span>
                  ) : (
                    <span className="search-dropdown__quick-add-icon" aria-hidden="true">+</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {products.length > 0 && totalMatchCount > MAX_RESULTS && (
        <button
          type="button"
          className="search-dropdown__view-all"
          onClick={goSearchResults}
        >
          {copy.products.viewAllResults || copy.products.showAll || 'View all results'}
        </button>
      )}
    </div>
  );
}