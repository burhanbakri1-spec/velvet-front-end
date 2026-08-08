import { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { getCategoryBySlug, productCategories, products } from '../data/products';
import { useI18n } from '../i18n/I18nContext';
import { Link, useRouter } from '../routing/Router';

export default function ProductsPage() {
  const { copy, locale } = useI18n();
  const { location } = useRouter();
  const params = new URLSearchParams(location.search);
  const activeCategory = getCategoryBySlug(params.get('category') || 'all');
  const [query, setQuery] = useState(params.get('search') || '');

  useEffect(() => setQuery(new URLSearchParams(location.search).get('search') || ''), [location.search]);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = activeCategory.id === 'all' || product.categoryId === activeCategory.id;
      const matchesSearch = !normalized || `${product.name} ${product.category} ${product.description} ${product.descriptionAr}`.toLowerCase().includes(normalized);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory.id, query]);

  return (
    <div className="products-page">
      <section className="store-hero">
        <span className="store-eyebrow">{copy.products.eyebrow}</span>
        <h1>{copy.products.title[0]}<br />{copy.products.title[1]}</h1>
        <p>{copy.products.intro}</p>
      </section>

      <section className="product-browser" aria-labelledby="products-title">
        <div className="product-browser__head">
          <div>
            <span className="store-eyebrow">{copy.products.collection}</span>
            <h2 id="products-title">{copy.products.products}</h2>
          </div>
          <label className="store-search">
            <span className="sr-only">{copy.products.search}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.products.placeholder} type="search" />
            <i aria-hidden="true" />
          </label>
        </div>

        <div className="category-filter" aria-label={copy.products.categories}>
          {productCategories.map((item) => (
            <Link className={activeCategory.id === item.id ? 'is-active' : ''} to={`/products?category=${item.slug}${query ? `&search=${encodeURIComponent(query)}` : ''}`} key={item.id}>{item.name[locale]}</Link>
          ))}
        </div>

        <div className="product-results-line"><span>{visibleProducts.length} {visibleProducts.length === 1 ? copy.products.countOne : copy.products.count}</span>{query && <Link to={`/products?category=${activeCategory.slug}`}>{copy.products.clear}</Link>}</div>

        {visibleProducts.length > 0 ? (
          <div className="product-grid">{visibleProducts.map((product) => <ProductCard product={product} key={product.id} />)}</div>
        ) : (
          <div className="product-empty-results"><h3>{copy.products.emptyTitle}</h3><p>{copy.products.emptyBody}</p><Link to="/products?category=all">{copy.products.showAll}</Link></div>
        )}
      </section>
    </div>
  );
}
