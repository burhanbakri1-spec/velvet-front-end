import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { localizePath, useRouter } from '../routing/Router';
import { filterProducts, getProductBySlug } from '../data/velvetCatalog';

const MAX_RESULTS = 8;

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

export default function SearchDropdown({ query, setQuery }) {
  const { copy, locale } = useI18n();
  const { navigate } = useRouter();
  const rootRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [totalMatchCount, setTotalMatchCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

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

  const trimmed = String(query || '').trim();
  if (!trimmed || dismissed) return null;

  const displayName = (product) => (
    locale === 'ar' ? (product.nameAr || product.name) : product.name
  ) || '';
  const displayImage = (product) => product.images?.[0] || product.image || '';

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
          {products.map((product) => (
            <button
              key={product.slug}
              type="button"
              className="search-dropdown__result"
              onClick={() => goProduct(product.slug)}
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
          ))}
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
