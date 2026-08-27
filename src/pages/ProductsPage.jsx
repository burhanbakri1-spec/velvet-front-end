import { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';
import ProductFilters from '../components/ProductFilters';
import ActiveFilters from '../components/ActiveFilters';
import MobileFilterDrawer from '../components/MobileFilterDrawer';
import PageNavigation from '../components/PageNavigation';
import { filterProducts, resolvePath } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { useShopState } from '../hooks/useShopState';

const MAX_VISIBLE = 48;

export default function ProductsPage() {
  const { copy, locale } = useI18n();
  const { state, toggle, removeFilter, clearFilters, resetAll, setSearch, activeFilterCount } = useShopState();
  const [limit, setLimit] = useState(MAX_VISIBLE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [queryInput, setQueryInput] = useState(state.search);

  useEffect(() => setQueryInput(state.search), [state.search]);
  useEffect(() => setLimit(MAX_VISIBLE), [state]);

  const results = useMemo(() => filterProducts(state), [state]);
  const path = useMemo(() => resolvePath(state), [state]);
  const shown = results.slice(0, limit);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const next = queryInput.trim();
    if (next === state.search) return;
    setSearch(next);
  };

  const showAllNote = results.length > shown.length;

  const breadcrumbs = [{ label: copy.meta.home, to: '/' }];
  if (path.brand) breadcrumbs.push({ label: path.brand.name[locale], to: `/brands/${state.brand}` });
  if (path.category) {
    breadcrumbs.push({
      label: path.category.name[locale],
      to: path.brand ? `/brands/${state.brand}/category/${state.category}` : undefined,
    });
  }
  if (path.sub) breadcrumbs.push({ label: path.sub.name[locale] });

  const fallback = state.brand ? `/brands/${state.brand}` : '/';

  return (
    <div className="shop-page">
      <PageNavigation fallbackPath={fallback} breadcrumbs={breadcrumbs} />
      <div className="shop-page__tools shop-page__tools--solo">
        <button type="button" className="tool-btn shop-mobile-filters" onClick={() => setDrawerOpen(true)}>
          {copy.shop.filters}
          {activeFilterCount > 0 && <span className="shop-mobile-filters__count">{activeFilterCount}</span>}
        </button>
      </div>

      <div className="shop-page__grid">
        <aside className="shop-filters" aria-label={copy.shop.filters}>
          <ProductFilters state={state} onToggle={toggle} onClear={clearFilters} />
        </aside>

        <main className="shop-content">
          <div className="shop-toolbar">
            <ActiveFilters state={state} onRemove={removeFilter} onClear={clearFilters} />
            <div className="shop-toolbar__right">
              <form className="shop-search" onSubmit={handleSearchSubmit} role="search">
                <label className="sr-only" htmlFor="shop-search-input">{copy.products.search}</label>
                <input
                  id="shop-search-input"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder={copy.products.placeholder}
                  type="search"
                />
                <i aria-hidden="true" />
              </form>
              <span className="shop-meta">{results.length} {results.length === 1 ? copy.products.countOne : copy.products.count}</span>
            </div>
          </div>

          {results.length > 0 ? (
            <>
              <div className="shop-products">
                {shown.map((product) => <ProductCard product={product} key={product.id} />)}
              </div>
              {showAllNote && (
                <div className="shop-more">
                  <button type="button" onClick={() => setLimit(results.length)}>
                    {copy.shop.showAll} {copy.shop.of} {results.length}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="shop-empty">
              <h3>{copy.shop.emptyTitle}</h3>
              <p>{copy.shop.emptyBody}</p>
              <div className="shop-empty__actions">
                <button type="button" onClick={clearFilters}>{copy.shop.resetFilters}</button>
                <button type="button" onClick={resetAll}>{copy.shop.resetAll}</button>
              </div>
            </div>
          )}
        </main>
      </div>

      <MobileFilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onClear={clearFilters}>
        <ProductFilters state={state} onToggle={toggle} onClear={clearFilters} />
      </MobileFilterDrawer>
    </div>
  );
}
