import { useEffect, useLayoutEffect, useState } from 'react';
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

    const pageTop = (node) => {
      let y = 0;
      let current = node;
      while (current) {
        y += current.offsetTop;
        current = current.offsetParent;
      }
      return y;
    };

    const sync = () => {
      const edge = parseFloat(getComputedStyle(root).getPropertyValue('--brand-hero-edge')) || 0;
      const sections = [...root.querySelectorAll(':scope > .home-brand')];
      const enabled = desktop.matches && !reduced.matches;
      const headerHidden = document.querySelector('.site-header.is-hidden');
      const pin = headerHidden
        ? 0
        : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
      const scroll = document.scrollingElement?.scrollTop || 0;

      sections.forEach((section) => {
        const hero = section.querySelector(':scope > .brand-showcase');
        if (!hero) return;
        hero.style.removeProperty('position');
        hero.style.removeProperty('top');
        hero.style.removeProperty('z-index');
      });

      sections.forEach((section, index) => {
        const hero = section.querySelector(':scope > .brand-showcase');
        if (!hero) return;
        if (!enabled || index === sections.length - 1) {
          section.style.removeProperty('--brand-runway');
          return;
        }
        const height = hero.offsetHeight || 0;
        section.style.setProperty('--brand-runway', `${Math.max(0, Math.round(height - edge))}px`);
        if (height === 0) return;

        const visualTop = pageTop(hero) - scroll < pin - 0.5 ? pin : pageTop(hero) - scroll;
        const strip = section.querySelector(':scope > .brand-strip');
        if (strip) {
          const stripTop = strip.getBoundingClientRect().top;
          const peek = stripTop - visualTop;
          if (peek > 0 && peek < height * 0.55) {
            hero.style.position = 'relative';
            hero.style.top = 'auto';
          }
        }
      });
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    sync();
    const observer = new ResizeObserver(schedule);
    root.querySelectorAll(':scope > .home-brand > .brand-showcase').forEach((hero) => observer.observe(hero));
    window.addEventListener('scroll', schedule, { passive: true });
    desktop.addEventListener('change', schedule);
    reduced.addEventListener('change', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      observer.disconnect();
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
