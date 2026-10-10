import { useLayoutEffect, useRef } from 'react';
import { getBrandLogo, isGeneratedBrandLogo } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { measureLogoInk, railLogoFit, railWordmarkSvg } from './railLogoFit';

function textWidth(text, font) {
  if (typeof document === 'undefined') return 0;
  const canvas = textWidth.canvas || (textWidth.canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(String(text || '')).width;
}

function railLogo(brand, locale) {
  const src = getBrandLogo(brand.slug, locale);
  if (!isGeneratedBrandLogo(src)) return { src, normalize: 'ink' };
  const accent = String(brand.accent || brand.home?.accent || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(accent)) return { src, normalize: 'ink' };
  const branch = brand.home?.logo?.[locale] || brand.short?.[locale] || '';
  const nameWidth = textWidth(branch, '900 40px Impact, "Arial Narrow", sans-serif');
  const velvetWidth = textWidth('VELVET', '700 13px Arial, Helvetica, sans-serif') + 13 * 0.12 * 5;
  const svg = railWordmarkSvg({ branch, accent, nameWidth, velvetWidth });
  return {
    src: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    normalize: 'frame',
  };
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
  const logo = railLogo(brand, locale);
  const ref = useRef(null);
  const fit = () => {
    if (logo.normalize === 'ink' && ref.current) fitRailImage(ref.current);
  };
  useLayoutEffect(() => {
    fit();
  }, [logo.src, logo.normalize]);
  return (
    <span className="brand-logo-rail__item" role="listitem">
      <img ref={ref} src={logo.src} alt={brand.name[locale]} data-logo-fit={logo.normalize} onLoad={fit} />
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
