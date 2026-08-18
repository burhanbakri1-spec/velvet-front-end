import { useEffect, useRef, useState } from 'react';
import { artwork } from '../data/products';
import { getBrand, getBrandLogo, getBrandMedia } from '../data/velvetCatalog';
import BrandShowcase from '../components/BrandShowcase';
import { PlayButton } from '../components/Hero';
import PageNavigation from '../components/PageNavigation';
import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';

// VELVET sub-brand page: renders like the parent VELVET homepage, but the
// full-width showcase banners represent this brand's categories instead of
// VELVET sub-brands. Brand hero on top, then one BrandShowcase per category
// linking to the shared shop filtered to /{locale}/products?brand=…&category=….
export default function BrandPage({ slug }) {
  const brand = getBrand(slug);
  const cursorRef = useRef(null);
  const { copy, locale } = useI18n();

  const moveCursor = (event) => {
    if (event.pointerType !== 'mouse' || window.innerWidth <= 760 || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const cursor = cursorRef.current;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.add('is-visible');
  };

  const hideCursor = () => cursorRef.current?.classList.remove('is-visible');

  if (!brand) {
    return (
      <section className="category-empty">
        <span className="store-eyebrow">VELVET</span>
        <h1>{copy.category.missing}</h1>
        <Link to="/products">{copy.category.allProducts}</Link>
      </section>
    );
  }

  const media = getBrandMedia(slug);
  const brandLogo = getBrandLogo(slug);

  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const mediaElement = videoRef.current;
    if (!mediaElement) return undefined;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    mediaElement.addEventListener('play', onPlay);
    mediaElement.addEventListener('pause', onPause);
    mediaElement.addEventListener('ended', onEnded);
    return () => {
      mediaElement.removeEventListener('play', onPlay);
      mediaElement.removeEventListener('pause', onPause);
      mediaElement.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlayback = async () => {
    const mediaElement = videoRef.current;
    if (!mediaElement) return;
    if (mediaElement.paused) {
      try { await mediaElement.play(); } catch { setPlaying(false); }
    } else mediaElement.pause();
  };

  return (
    <div className="category-page">
      <PageNavigation
        fallbackPath="/"
        breadcrumbs={[
          { label: copy.meta.home, to: '/' },
          { label: brand.name[locale] },
        ]}
      />
      <section
        className={`category-hero brand-hero ${playing ? 'is-playing' : 'is-paused'}`}
        style={{ '--c1': brand.accent, '--c2': brand.palette[1], '--c3': brand.palette[2] }}
        onPointerEnter={moveCursor}
        onPointerMove={moveCursor}
        onPointerLeave={hideCursor}
      >
        {media.video ? (
          <video ref={videoRef} className="category-hero__media" src={media.video} poster={media.poster || brand.image} autoPlay muted loop playsInline onClick={togglePlayback} />
        ) : (
          <img className="category-hero__media" src={media.poster || brand.image} alt="" />
        )}
        <div className="category-hero__shade" aria-hidden="true" />
        <a className="category-hero__link" href="#category-products" aria-label={`${copy.home.view} ${brand.name[locale]}`} />
        <div className="category-hero__title">
          <span className="category-hero__logo">
            {brandLogo ? <img className="category-hero__logo-img" src={brandLogo} alt={brand.name[locale]} /> : brand.home.logo[locale]}
          </span>
          <h1>{brand.name[locale]}</h1>
        </div>
        <p className="category-hero__description">{brand.tagline[locale]}</p>
        {media.video && <PlayButton label={playing ? copy.home.pause : copy.home.play} playing={playing} onClick={togglePlayback} />}
        <span className="showcase-view-cursor" ref={cursorRef} aria-hidden="true">{copy.home.view}</span>
      </section>

      <section className="category-showcases" id="category-products" aria-label={`${brand.name[locale]} ${copy.shop.category}`}>
        {brand.categories.map((category, index) => (
          <BrandShowcase
            key={category.slug}
            to={`/products?brand=${slug}&category=${category.slug}`}
            brand={{
              ...brand,
              slug: category.slug,
              name: category.name,
              image: category.heroImage || artwork(category.name.en, brand.home.palette, (index % 6) + 1),
              palette: brand.home.palette,
              scene: brand.home.scene,
              home: {
                logo: brand.home.logo,
                kickerEn: brand.home.kickerEn,
                kickerAr: brand.home.kickerAr,
              },
            }}
          />
        ))}
      </section>
    </div>
  );
}