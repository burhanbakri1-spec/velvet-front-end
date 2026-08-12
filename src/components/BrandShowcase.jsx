import { useRef } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';

export default function BrandShowcase({ brand, to }) {
  const viewCursorRef = useRef(null);
  const { copy, locale } = useI18n();
  const arrow = locale === 'ar' ? '←' : '→';
  const name = brand.name[locale];
  const brandPath = to || `/brands/${brand.slug}`;
  const logo = brand.home.logo[locale];

  const moveViewCursor = (event) => {
    if (event.pointerType !== 'mouse' || window.innerWidth <= 760 || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const cursor = viewCursorRef.current;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.add('is-visible');
  };

  const hideViewCursor = () => viewCursorRef.current?.classList.remove('is-visible');

  return (
    <article
      className={`brand-showcase brand-showcase--${brand.scene}`}
      style={{ '--c1': brand.palette[0], '--c2': brand.palette[1], '--c3': brand.palette[2] }}
      onPointerEnter={moveViewCursor}
      onPointerMove={moveViewCursor}
      onPointerLeave={hideViewCursor}
    >
      <img className="brand-showcase__image" src={brand.image} alt="" />
      <div className="brand-showcase__tint" aria-hidden="true" />
      <Link className="brand-showcase__link" to={brandPath} aria-label={`${copy.home.view} ${name}`} />
      <div className="brand-showcase__content">
        <span className="brand-showcase__logo" aria-hidden="true">{logo}</span>
        <p>{locale === 'ar' ? brand.home.kickerAr : brand.home.kickerEn}</p>
        <h2>{name}</h2>
      </div>
      <span className="showcase-view-cursor" ref={viewCursorRef} aria-hidden="true">{copy.home.view}</span>
      <Link className="showcase-more" to={brandPath}>
        <span className="showcase-more__arrow showcase-more__arrow--left" aria-hidden="true">{arrow}</span>
        <span className="showcase-more__label">{copy.home.seeMore}</span>
        <span className="showcase-more__arrow showcase-more__arrow--right" aria-hidden="true">{arrow}</span>
      </Link>
    </article>
  );
}
