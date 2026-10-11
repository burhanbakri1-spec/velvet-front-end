import { getBrandLogo, hasUploadedBrandLogo } from '../data/velvetCatalog';
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
      {brands.map((brand) => {
        const logoSrc = getBrandLogo(brand.slug, locale);
        const managed = hasUploadedBrandLogo(brand.slug, locale);
        return (
          <div className="brand-banner-slice" key={brand.slug}>
            <div className="brand-banner-slice__stage">
              <img className="brand-showcase__image" src={brand.image} alt="" />
              {logoSrc ? (
                <span className={`brand-logo-frame brand-showcase__brand-logo-frame${managed ? ' brand-logo-frame--managed' : ''}`}>
                  <img
                    className={`brand-logo brand-showcase__brand-logo${managed ? ' brand-showcase__brand-logo--managed' : ''}`}
                    src={logoSrc}
                    alt=""
                  />
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
