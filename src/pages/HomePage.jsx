import { useEffect, useLayoutEffect, useState } from 'react';
import IntroLoader from '../components/IntroLoader';
import Header from '../components/Header';
import Hero from '../components/Hero';
import IntroSection from '../components/IntroSection';
import BrandShowcase from '../components/BrandShowcase';
import BrandLogoRail from '../components/BrandLogoRail';
import BrandProductStrip from '../components/BrandProductStrip';
import CareersSection from '../components/CareersSection';
import StoreReviewsSection from '../components/StoreReviewsSection';
import Footer from '../components/Footer';
import { velvetBrands } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';

export default function HomePage() {
  const previewTarget = new URLSearchParams(window.location.search).get('view');
  const [introActive, setIntroActive] = useState(!previewTarget);
  const [activeBrand, setActiveBrand] = useState(0);
  const { copy } = useI18n();
  const brands = [...velvetBrands].sort((a, b) => a.home.order - b.home.order);

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

  useLayoutEffect(() => {
    const root = document.getElementById('showcases');
    if (!root) return undefined;
    const desktop = window.matchMedia('(min-width: 1101px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const railHeight = 48;

    const sync = () => {
      const enabled = desktop.matches && !reduced.matches;
      if (!enabled) {
        root.style.setProperty('--brand-rail-height', '0px');
        setActiveBrand((current) => (current === 0 ? current : 0));
        return;
      }
      const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 88;
      const pin = document.querySelector('.site-header.is-hidden') ? 0 : headerH;
      const heroes = [...root.querySelectorAll(':scope > .home-brand > .brand-showcase')];
      const railOn = root.style.getPropertyValue('--brand-rail-height') === `${railHeight}px`;
      const line = pin + (railOn ? railHeight : 0);
      let active = 0;
      heroes.forEach((hero, index) => {
        if (hero.getBoundingClientRect().top <= line + 2) active = index;
      });
      const nextRail = active > 0 ? `${railHeight}px` : '0px';
      if (root.style.getPropertyValue('--brand-rail-height') !== nextRail) {
        root.style.setProperty('--brand-rail-height', nextRail);
      }
      setActiveBrand((current) => (current === active ? current : active));
    };

    let again = false;
    const schedule = () => {
      if (frame) {
        again = true;
        return;
      }
      const run = () => {
        frame = 0;
        sync();
        if (!again) return;
        again = false;
        frame = window.requestAnimationFrame(run);
      };
      frame = window.requestAnimationFrame(run);
    };

    sync();
    const observer = new ResizeObserver(schedule);
    root.querySelectorAll(':scope > .home-brand > .brand-showcase').forEach((hero) => observer.observe(hero));
    const header = document.querySelector('.site-header');
    const headerObserver = new MutationObserver(schedule);
    if (header) headerObserver.observe(header, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    desktop.addEventListener('change', schedule);
    reduced.addEventListener('change', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      headerObserver.disconnect();
      desktop.removeEventListener('change', schedule);
      reduced.removeEventListener('change', schedule);
    };
  }, []);

  return (
    <>
      <IntroLoader active={introActive} />
      <Header introActive={introActive} />
      <main>
        <Hero introActive={introActive} />
        <IntroSection />
        <section id="showcases" aria-label={copy.home.worlds}>
          <BrandLogoRail brands={brands.slice(0, activeBrand)} />
          {brands.map((brand, index) => (
            <section className="home-brand" key={brand.slug}>
              <BrandShowcase
                variant="full-banner"
                showBrandLogo
                deckIndex={index}
                mediaLoading={index === 0 ? 'eager' : 'lazy'}
                mediaFetchPriority={index === 0 ? 'high' : undefined}
                brand={{ ...brand, image: brand.image, palette: brand.home.palette, scene: brand.home.scene }}
              />
              <BrandProductStrip brandSlug={brand.slug} deckIndex={index} />
              <div className="home-brand__runway" aria-hidden="true" />
            </section>
          ))}
        </section>
        <StoreReviewsSection />
        <CareersSection />
      </main>
      <Footer />
    </>
  );
}
