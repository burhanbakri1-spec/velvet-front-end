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
import { getBrandLogo, velvetBrands } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';

export default function HomePage() {
  const previewTarget = new URLSearchParams(window.location.search).get('view');
  const [introActive, setIntroActive] = useState(!previewTarget);
  const { copy, locale } = useI18n();
  const brands = [...velvetBrands].sort((a, b) => a.home.order - b.home.order);

  useEffect(() => {
    const root = document.getElementById('showcases');
    if (!root) return undefined;
    const desktop = window.matchMedia('(min-width: 1101px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    const pack = () => {
      frame = 0;
      const tabs = [...root.querySelectorAll('.brand-deck-tab')];
      const banners = [...root.querySelectorAll(':scope > .brand-showcase.brand-showcase--full-banner')];
      if (!desktop.matches || reduced.matches) {
        tabs.forEach((tab) => tab.classList.remove('is-collapsed'));
        return;
      }
      const headerHidden = document.querySelector('.site-header.is-hidden');
      const header = headerHidden
        ? 0
        : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
      const edge = parseFloat(getComputedStyle(root).getPropertyValue('--brand-deck-edge')) || 56;
      let active = 0;
      banners.forEach((banner, index) => {
        if (banner.getBoundingClientRect().top <= header + edge + 8) active = index;
      });
      tabs.forEach((tab, index) => tab.classList.toggle('is-collapsed', index < active));
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(pack);
    };

    pack();
    window.addEventListener('scroll', onScroll, { passive: true });
    desktop.addEventListener('change', pack);
    reduced.addEventListener('change', pack);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
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
        <section id="showcases" aria-label={copy.home.worlds} style={{ '--brand-deck-count': brands.length }}>
          {brands.map((brand, index) => (
            <Fragment key={brand.slug}>
              <div
                className={`brand-deck-tab${index === 0 ? ' brand-deck-tab--base' : ''}`}
                style={{ '--deck-index': index, '--c1': brand.home.palette[0] }}
                aria-hidden="true"
              >
                <span className="brand-deck-tab__logo">
                  <img src={getBrandLogo(brand.slug, locale)} alt="" />
                </span>
              </div>
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
