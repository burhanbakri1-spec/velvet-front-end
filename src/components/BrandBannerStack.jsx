import { getBrandLogo } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
export { BRAND_BANNER_STACK, brandBannerStackHeight } from './brandBannerMetrics.js';

export default function BrandBannerStack({ brands }) {
  const { locale } = useI18n();
  const empty = brands.length === 0;

  return (
    <div
      className="brand-banner-stack"
      data-empty={empty ? 'true' : undefined}
      aria-hidden="true"
    >
      {brands.map((brand) => (
        <div className="brand-banner-slice" key={brand.slug}>
          <img className="brand-banner-slice__banner" src={brand.image} alt="" />
          <img className="brand-banner-slice__logo" src={getBrandLogo(brand.slug, locale)} alt="" />
        </div>
      ))}
    </div>
  );
}
