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
        banners.forEach((banner) => {
          banner.classList.remove('is-collapsed');
          banner.classList.remove('is-upcoming');
        });
        root.style.removeProperty('--brand-deck-lead');
        root.style.removeProperty('--brand-deck-slot');
        return;
      }
      const slice = 112;
      const headerHidden = document.querySelector('.site-header.is-hidden');
      const headerH = headerHidden
        ? 0
        : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
      root.style.setProperty('--brand-deck-header', `${headerH}px`);
      const measureActive = () => {
        let next = 0;
        const line = headerH + slice + 8;
        banners.forEach((banner, index) => {
          if (banner.getBoundingClientRect().top <= line) next = index;
        });
        return next;
      };
      const apply = (active) => {
        const heroH = banners[Math.min(active, banners.length - 1)].getBoundingClientRect().height || slice;
        const maxBand = Math.max(slice, window.innerHeight - heroH - 8);
        const band = active > 0 ? Math.min(headerH + slice, maxBand) : headerH;
        root.style.setProperty('--brand-deck-lead', `${band}px`);
        root.style.setProperty('--brand-deck-slot', `${root.clientWidth / Math.max(active, 1)}px`);
        banners.forEach((banner, index) => {
          banner.classList.toggle('is-collapsed', index < active);
          banner.classList.toggle('is-upcoming', index > active);
        });
      };
      apply(measureActive());
      apply(measureActive());
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
