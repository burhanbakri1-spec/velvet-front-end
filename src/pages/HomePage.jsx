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

    const sync = () => {
      const heroes = [...root.querySelectorAll(':scope > .home-brand > .brand-showcase')];
      const enabled = desktop.matches && !reduced.matches;
      if (!enabled) {
        heroes.forEach((hero) => {
          hero.style.removeProperty('overflow');
          const frame = hero.querySelector('.brand-showcase__brand-logo-frame');
          frame?.style.removeProperty('top');
          frame?.style.removeProperty('transform');
          frame?.style.removeProperty('transform-origin');
        });
        return;
      }
      const rootStyle = getComputedStyle(root);
      const slice = parseFloat(rootStyle.getPropertyValue('--brand-stack-slice')) || 48;
      const band = parseFloat(rootStyle.getPropertyValue('--brand-hero-edge')) || 140;
      const origin = document.documentElement.dir === 'rtl' ? 'top right' : 'top left';
      heroes.forEach((hero, index) => {
        const frame = hero.querySelector('.brand-showcase__brand-logo-frame');
        const next = heroes[index + 1];
        if (!frame) return;
        if (!frame.dataset.naturalTop && !frame.style.top) {
          frame.dataset.naturalTop = String(parseFloat(getComputedStyle(frame).top) || 0);
        }
        const clear = () => {
          hero.style.removeProperty('overflow');
          frame.style.removeProperty('top');
          frame.style.removeProperty('transform');
          frame.style.removeProperty('transform-origin');
        };
        if (!next) {
          clear();
          return;
        }
        const visible = next.getBoundingClientRect().top - hero.getBoundingClientRect().top;
        if (visible >= band - 0.5) {
          clear();
          return;
        }
        const frameH = frame.offsetHeight || 104;
        const inkH = frame.querySelector('img')?.offsetHeight || frameH;
        const inkOffset = Math.max(0, (frameH - inkH) / 2);
        const endScale = Math.min(1, (slice - 8) / Math.max(1, inkH));
        const endTop = 4 - inkOffset * endScale;
        const t = Math.max(0, Math.min(1, (band - visible) / Math.max(1, band - slice)));
        const naturalTop = parseFloat(frame.dataset.naturalTop) || 0;
        const scale = 1 + (endScale - 1) * t;
        const top = naturalTop + (endTop - naturalTop) * t;
        hero.style.overflow = 'hidden';
        frame.style.transformOrigin = origin;
        frame.style.top = `${top.toFixed(2)}px`;
        frame.style.transform = `scale(${scale.toFixed(4)})`;
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
