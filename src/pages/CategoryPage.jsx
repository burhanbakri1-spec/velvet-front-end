import CategoryHero from '../components/CategoryHero';
import CategoryProductShowcase from '../components/CategoryProductShowcase';
import { getCategoryBySlug, getProductsByCategory } from '../data/products';
import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';

export default function CategoryPage({ slug }) {
  const category = getCategoryBySlug(slug);
  const categoryProducts = category.id === 'all' ? [] : getProductsByCategory(category.id);
  const { copy } = useI18n();

  if (category.id === 'all') {
    return (
      <section className="category-empty">
        <span className="store-eyebrow">{copy.category.eyebrow}</span>
        <h1>{copy.category.missing}</h1>
        <Link to="/products">{copy.category.allProducts}</Link>
      </section>
    );
  }

  return (
    <div className="category-page">
      <CategoryHero category={category} />
      {categoryProducts.length ? (
        <CategoryProductShowcase category={category} products={categoryProducts} />
      ) : (
        <section className="category-empty" id="category-products">
          <span className="store-eyebrow">VELVET</span>
          <h2>{copy.category.empty}</h2>
          <Link to="/products">{copy.category.allProducts}</Link>
        </section>
      )}
    </div>
  );
}
