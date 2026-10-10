import { Fragment, useEffect, useState } from 'react';
import IntroLoader from '../components/IntroLoader';
import Header from '../components/Header';
import Hero from '../components/Hero';
import IntroSection from '../components/IntroSection';
import BrandShowcase from '../components/BrandShowcase';
import BrandProductStrip from '../components/BrandProductStrip';
import CareersSection from '../components/CareersSection';
import StoreReviewsSection from '../components/StoreReviewsSection';
import Footer from '../components/Footer';
import { velvetBrands } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';

export default function HomePage() {
  const previewTarget = new URLSearchParams(window.location.search).get('view');
  const [introActive, setIntroActive] = useState(!previewTarget);
  const { copy } = useI18n();
  const brands = [...velvetBrands].sort((a, b) => a.home.order - b.home.order);

  useEffect(() => {
    const root = document.getElementById('showcases');
    if (!root) return undefined;
    const desktop = window.matchMedia('(min-width: 1101px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    const pack = () => {
      frame = 0;
      const banners = [...root.querySelectorAll(':scope > .brand-showcase.brand-showcase--full-banner')];
      if (!desktop.matches || reduced.matches || banners.length === 0) {
        banners.forEach((banner) => banner.classList.remove('is-collapsed'));
        return;
      }
      const heroH = banners[0].getBoundingClientRect().height;
      const slots = Math.max(banners.length - 1, 1);
      const available = Math.max(0, window.innerHeight - heroH);
      const fitted = Math.floor(available / slots);
      const edge = Math.min(48, Math.max(16, fitted || 16));
      root.style.setProperty('--brand-deck-edge', `${edge}px`);
      let active = 0;
      banners.forEach((banner, index) => {
        if (banner.getBoundingClientRect().top <= (index * edge) + edge) active = index;
      });
      banners.forEach((banner, index) => banner.classList.toggle('is-collapsed', index < active));
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(pack);
    };

    const images = [...root.querySelectorAll('.brand-showcase__image')];
    pack();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    images.forEach((image) => image.addEventListener('load', onScroll));
    desktop.addEventListener('change', pack);
    reduced.addEventListener('change', pack);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      images.forEach((image) => image.removeEventListener('load', onScroll));
      desktop.removeEventListener('change', pack);
      reduced.removeEventListener('change', pack);
    };
  }, []);

  useEffect(() => {
    if (previewTarget) {
      requestAnimationFrame(() => document.getElementById(previewTarget)?.scrollIntoView());
      return undefined;
    }
    document.documentElement.classList.add('intro-active');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      setIntroActive(false);
      document.documentElement.classList.remove('intro-active');
    }, reduced ? 80 : 3150);
    return () => {
      window.clearTimeout(timer);
      document.documentElement.classList.remove('intro-active');
    };
  }, [previewTarget]);

  return (
    <>
      <IntroLoader active={introActive} />
      <Header introActive={introActive} />
      <main>
        <Hero introActive={introActive} />
        <IntroSection />
        <section id="showcases" aria-label={copy.home.worlds}>
          {brands.map((brand, index) => (
            <Fragment key={brand.slug}>
              <BrandShowcase
                variant="full-banner"
                showBrandLogo
                deckIndex={index}
                mediaLoading={index === 0 ? 'eager' : 'lazy'}
                mediaFetchPriority={index === 0 ? 'high' : undefined}
                brand={{ ...brand, image: brand.image, palette: brand.home.palette, scene: brand.home.scene }}
              />
              <BrandProductStrip brandSlug={brand.slug} deckIndex={index} />
            </Fragment>
          ))}
        </section>
        <StoreReviewsSection />
        <CareersSection />
      </main>
      <Footer />
    </>
  );
}
