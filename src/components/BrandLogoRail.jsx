import { getBrandLogo, isGeneratedBrandLogo } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';

function railLogo(brand, locale) {
  const src = getBrandLogo(brand.slug, locale);
  if (!isGeneratedBrandLogo(src)) return src;
  const accent = String(brand.accent || brand.home?.accent || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(accent)) return src;
  const svg = decodeURIComponent(src.replace(/^data:image\/svg\+xml;charset=UTF-8,/, ''))
    .replace('viewBox="0 0 420 88"', 'viewBox="70 0 280 88"')
    .replace(/fill="#ffffff"/gi, `fill="#${accent}"`)
    .replace(/text-anchor="(?:start|end)"/g, 'text-anchor="middle"')
    .replace(/x="(?:24|396)"/g, 'x="210"');
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

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
          <img src={railLogo(brand, locale)} alt={brand.name[locale]} />
        </span>
      ))}
    </div>
  );
}
