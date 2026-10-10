import { useLayoutEffect, useRef } from 'react';
import { getBrandLogo, isGeneratedBrandLogo } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { measureLogoInk, railLogoFit } from './railLogoFit';

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

function fitRailImage(img) {
  const maxW = parseFloat(getComputedStyle(img).maxWidth);
  const maxH = parseFloat(getComputedStyle(img).maxHeight);
  if (!maxW || !maxH) return;
  const ink = measureLogoInk(img);
  img.style.transform = '';
  img.style.transformOrigin = '';
  if (!ink) return;
  const fit = railLogoFit({ ...ink, maxW: maxW - 1, maxH: maxH - 1 });
  if (!fit || fit.boost < 1.02) return;
  img.style.transformOrigin = `${fit.originX * 100}% ${fit.originY * 100}%`;
  img.style.transform = `translate(${fit.tx}px, ${fit.ty}px) scale(${fit.boost})`;
}

function RailLogo({ brand, locale }) {
  const src = railLogo(brand, locale);
  const ref = useRef(null);
  const fit = () => {
    if (ref.current) fitRailImage(ref.current);
  };
  useLayoutEffect(() => {
    fit();
  }, [src]);
  return (
    <span className="brand-logo-rail__item" role="listitem">
      <img ref={ref} src={src} alt={brand.name[locale]} onLoad={fit} />
    </span>
  );
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
        <RailLogo brand={brand} locale={locale} key={brand.slug} />
      ))}
    </div>
  );
}
