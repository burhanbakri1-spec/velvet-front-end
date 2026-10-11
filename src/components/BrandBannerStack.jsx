export { BRAND_BANNER_STACK, brandBannerStackHeight } from './brandBannerMetrics.js';

export default function BrandBannerStack({ brands }) {
  const empty = brands.length === 0;

  return (
    <div
      className="brand-banner-stack"
      data-empty={empty ? 'true' : undefined}
      aria-hidden="true"
    >
      {brands.map((brand) => (
        <div className="brand-banner-slice" key={brand.slug}>
          <div className="brand-banner-slice__stage">
            <img className="brand-showcase__image" src={brand.image} alt="" />
          </div>
        </div>
      ))}
    </div>
  );
}
