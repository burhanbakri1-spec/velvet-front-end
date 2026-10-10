import { getBrandLogo } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';

export default function BrandLogoRail({ brands }) {
  const { locale, copy } = useI18n();
  const empty = brands.length === 0;

  return (
    <div
      className="brand-logo-rail"
      data-empty={empty ? 'true' : undefined}
      role={empty ? undefined : 'list'}
      aria-label={empty ? undefined : copy.home.worlds}
      aria-hidden={empty ? 'true' : undefined}
    >
      {brands.map((brand) => (
        <span className="brand-logo-rail__item" role="listitem" key={brand.slug}>
          <img src={getBrandLogo(brand.slug, locale)} alt={brand.name[locale]} />
        </span>
      ))}
    </div>
  );
}
