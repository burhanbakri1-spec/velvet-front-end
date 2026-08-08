import { useRef } from 'react';
import { useI18n } from '../i18n/I18nContext';

export default function CategoryHero({ category }) {
  const cursorRef = useRef(null);
  const { copy, locale } = useI18n();
  const name = category.name[locale];
  const description = locale === 'ar' ? category.descriptionAr : category.descriptionEn;

  const moveCursor = (event) => {
    if (event.pointerType !== 'mouse' || window.innerWidth <= 760 || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const cursor = cursorRef.current;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.add('is-visible');
  };

  const hideCursor = () => cursorRef.current?.classList.remove('is-visible');

  return (
    <section className="category-hero" onPointerEnter={moveCursor} onPointerMove={moveCursor} onPointerLeave={hideCursor}>
      {category.heroVideo ? (
        <video className="category-hero__media" src={category.heroVideo} poster={category.heroImage} autoPlay muted loop playsInline />
      ) : (
        <img className="category-hero__media" src={category.heroImage} alt="" />
      )}
      <div className="category-hero__shade" aria-hidden="true" />
      <a className="category-hero__link" href="#category-products" aria-label={`${copy.home.view} ${name}`} />
      <div className="category-hero__title">
        <span>{copy.category.eyebrow}</span>
        <h1>{name}</h1>
      </div>
      <p className="category-hero__description">{description}</p>
      <span className="showcase-view-cursor" ref={cursorRef} aria-hidden="true">{copy.home.view}</span>
    </section>
  );
}
