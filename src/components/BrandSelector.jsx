import { velvetBrands } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';

export default function BrandSelector({ activeSlug = '' }) {
  const { copy, locale } = useI18n();
  const brands = [...velvetBrands].sort((a, b) => (a.home?.order || 0) - (b.home?.order || 0));

  return (
    <nav className="brand-selector" aria-label={copy.shop.brand}>
      <div className="brand-selector__row">
        {brands.map((brand) => {
          const active = brand.slug === activeSlug;
          return (
            <Link
              key={brand.slug}
              className={`brand-selector__chip${active ? ' is-active' : ''}`}
              to={`/products?brand=${encodeURIComponent(brand.slug)}`}
              aria-current={active ? 'page' : undefined}
            >
              {brand.name[locale]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
