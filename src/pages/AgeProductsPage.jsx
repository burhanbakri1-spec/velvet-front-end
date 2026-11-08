import { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';
import ShopFilterBar from '../components/ShopFilterBar';
import PageNavigation from '../components/PageNavigation';
import { getCanonicalAgeGroups, selectAgeBrowseProducts } from '../data/ageBrowse';
import { filterProducts, sortProducts } from '../data/velvetCatalog';
import { getShopPriority, isExplicitCustomerSort, orderShopCatalog } from '../data/displayPriority';
import { useI18n } from '../i18n/I18nContext';
import { useShopGridDensity } from '../hooks/useShopGridDensity';
import { useShopState } from '../hooks/useShopState';

const MAX_VISIBLE = 48;
const HIDDEN_FILTER_GROUPS = Object.freeze(['age']);

export default function AgeProductsPage({ ageId }) {
  const { copy, locale } = useI18n();
  const age = useMemo(() => getCanonicalAgeGroups().find((item) => item.id === ageId) || null, [ageId]);
  const { state, toggle, select, removeFilter, clearFilters, resetAll, setSearch, setSort, clearGroup } = useShopState({
    basePath: `/shop-by-age/${encodeURIComponent(ageId)}`,
    fixedAgeId: ageId,
  });
  const { gridCols, setGridCols } = useShopGridDensity();
  const [limit, setLimit] = useState(MAX_VISIBLE);

  useEffect(() => setLimit(MAX_VISIBLE), [state]);

  const results = useMemo(() => {
    if (!age) return [];
    const exactAgeProducts = selectAgeBrowseProducts(filterProducts(state), age.id);
    if (isExplicitCustomerSort(state.sort)) return sortProducts(exactAgeProducts, state.sort, locale);
    const priority = getShopPriority('');
    if (!priority?.orderedIds?.length) return sortProducts(exactAgeProducts, state.sort, locale);
    return orderShopCatalog(exactAgeProducts, priority.orderedIds);
  }, [age, locale, state]);

  if (!age) {
    return <div className="age-browse-page"><PageNavigation breadcrumbs={[{ label: copy.home.shopByAge, to: '/shop-by-age' }]} /><section className="shop-empty"><h1>{copy.detail.missing}</h1></section></div>;
  }

  const shown = results.slice(0, limit);
  const showAllNote = results.length > shown.length;
  const title = age.name[locale];

  return (
    <div className="age-browse-page shop-page" data-age-route={age.id}>
      <PageNavigation breadcrumbs={[{ label: copy.home.shopByAge, to: '/shop-by-age' }, { label: title }]} />
      <header className="age-browse-header">
        <p>{copy.home.ageEyebrow}</p>
        <h1>{title}</h1>
        <span>{copy.home.agePageIntro}</span>
      </header>
      <ShopFilterBar
        state={state}
        resultCount={results.length}
        onToggle={toggle}
        onSelect={select}
        onRemove={removeFilter}
        onClearGroup={clearGroup}
        onClearAll={clearFilters}
        onSortChange={setSort}
        onSearchChange={setSearch}
        gridCols={gridCols}
        onGridColsChange={setGridCols}
        hiddenFilterGroups={HIDDEN_FILTER_GROUPS}
      />
      <main className="shop-content">
        {results.length ? (
          <>
            <div className={`shop-products shop-products--pref-${gridCols}`} data-shop-grid-cols={gridCols}>
              {shown.map((product) => <ProductCard product={product} key={product.id || product.slug} />)}
            </div>
            {showAllNote && <div className="shop-more"><button type="button" onClick={() => setLimit(results.length)}>{copy.shop.showAll} {copy.shop.of} {results.length}</button></div>}
          </>
        ) : (
          <div className="shop-empty"><h3>{copy.shop.emptyTitle}</h3><p>{copy.shop.emptyBody}</p><div className="shop-empty__actions"><button type="button" onClick={clearFilters}>{copy.shop.resetFilters}</button><button type="button" onClick={resetAll}>{copy.shop.resetAll}</button></div></div>
        )}
      </main>
    </div>
  );
}
