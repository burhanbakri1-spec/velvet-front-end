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

    const clearFit = (hero) => {
      hero.style.removeProperty('height');
      hero.querySelector('.brand-showcase__image')?.style.removeProperty('position');
      hero.querySelector('.brand-showcase__image')?.style.removeProperty('inset');
      hero.querySelector('.brand-showcase__image')?.style.removeProperty('top');
      hero.querySelector('.brand-showcase__image')?.style.removeProperty('left');
      hero.querySelector('.brand-showcase__image')?.style.removeProperty('width');
      hero.querySelector('.brand-showcase__image')?.style.removeProperty('height');
      hero.querySelector('.brand-showcase__image')?.style.removeProperty('object-fit');
      hero.querySelector('.brand-showcase__image')?.style.removeProperty('object-position');
      hero.querySelector('.brand-showcase__tint')?.style.removeProperty('height');
      hero.querySelector('.brand-showcase__tint')?.style.removeProperty('top');
      hero.querySelector('.brand-showcase__tint')?.style.removeProperty('bottom');
      hero.querySelector('.brand-showcase__content')?.style.removeProperty('bottom');
      hero.querySelector('.showcase-more')?.style.removeProperty('bottom');
    };

    const naturalHeroHeight = (hero) => {
      const image = hero.querySelector('.brand-showcase__image');
      if (!image || !image.naturalWidth) return 0;
      return hero.clientWidth * image.naturalHeight / image.naturalWidth;
    };

    const sync = () => {
      const heroes = [...root.querySelectorAll(':scope > .home-brand > .brand-showcase')];
      const enabled = desktop.matches && !reduced.matches;
      if (!enabled) {
        root.style.removeProperty('--brand-stack-slice');
        heroes.forEach((hero) => {
          hero.style.removeProperty('overflow');
          clearFit(hero);
          const frame = hero.querySelector('.brand-showcase__brand-logo-frame');
          frame?.style.removeProperty('top');
          frame?.style.removeProperty('transform');
          frame?.style.removeProperty('transform-origin');
        });
        return;
      }
      const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 88;
      const view = window.innerHeight;
      const band = parseFloat(getComputedStyle(root).getPropertyValue('--brand-hero-edge')) || 140;
      const minHero = 360;
      const minSlice = 32;
      const maxSlice = 48;
      const maxPrev = Math.max(1, heroes.length - 1);
      const room = view - headerH - minHero;
      let slice = maxSlice;
      if (maxPrev * slice > room) slice = Math.max(minSlice, room / maxPrev);
      slice = Math.floor(slice);
      if (root.style.getPropertyValue('--brand-stack-slice') !== `${slice}px`) {
        root.style.setProperty('--brand-stack-slice', `${slice}px`);
      }
      const origin = document.documentElement.dir === 'rtl' ? 'top right' : 'top left';
      const headerHidden = document.querySelector('.site-header.is-hidden');
      const pin = headerHidden ? 0 : headerH;
      let active = 0;
      heroes.forEach((hero, index) => {
        if (hero.getBoundingClientRect().top <= pin + index * slice + 1.5) active = index;
      });
      heroes.forEach((hero, index) => {
        const frame = hero.querySelector('.brand-showcase__brand-logo-frame');
        const next = heroes[index + 1];
        if (frame && !frame.dataset.naturalTop && !frame.style.top) {
          frame.dataset.naturalTop = String(parseFloat(getComputedStyle(frame).top) || 0);
        }
        const clearLogo = () => {
          hero.style.removeProperty('overflow');
          frame?.style.removeProperty('top');
          frame?.style.removeProperty('transform');
          frame?.style.removeProperty('transform-origin');
        };
        if (!frame || !next) clearLogo();
        else {
          const visible = next.getBoundingClientRect().top - hero.getBoundingClientRect().top;
          if (visible >= band - 0.5) clearLogo();
          else {
            const frameH = frame.offsetHeight || 104;
            const inkH = frame.querySelector('img')?.offsetHeight || frameH;
            const inkOffset = Math.max(0, (frameH - inkH) / 2);
            const endScale = Math.min(1, (slice - 8) / Math.max(1, inkH));
            const endTop = 4 - inkOffset * endScale;
            const progress = Math.max(0, Math.min(1, (band - visible) / Math.max(1, band - slice)));
            const naturalTop = parseFloat(frame.dataset.naturalTop) || 0;
            const scale = 1 + (endScale - 1) * progress;
            const top = naturalTop + (endTop - naturalTop) * progress;
            hero.style.overflow = 'hidden';
            frame.style.transformOrigin = origin;
            frame.style.top = `${top.toFixed(2)}px`;
            frame.style.transform = `scale(${scale.toFixed(4)})`;
          }
        }
        if (index !== active) {
          clearFit(hero);
          return;
        }
        const natural = naturalHeroHeight(hero);
        const fit = Math.round(view - hero.getBoundingClientRect().top);
        if (!natural || natural <= fit + 1) {
          clearFit(hero);
          return;
        }
        const lift = Math.max(0, natural - fit);
        hero.style.height = `${Math.round(natural)}px`;
        const image = hero.querySelector('.brand-showcase__image');
        image.style.position = 'absolute';
        image.style.top = '0';
        image.style.left = '0';
        image.style.width = '100%';
        image.style.height = `${fit}px`;
        image.style.objectFit = 'cover';
        image.style.objectPosition = 'center';
        const tint = hero.querySelector('.brand-showcase__tint');
        if (tint) {
          tint.style.top = '0';
          tint.style.bottom = 'auto';
          tint.style.height = `${fit}px`;
        }
        const content = hero.querySelector('.brand-showcase__content');
        const cta = hero.querySelector('.showcase-more');
        if (content && !content.dataset.naturalBottom) {
          content.dataset.naturalBottom = String(parseFloat(getComputedStyle(content).bottom) || 0);
        }
        if (cta && !cta.dataset.naturalBottom) {
          cta.dataset.naturalBottom = String(parseFloat(getComputedStyle(cta).bottom) || 0);
        }
        if (content) content.style.bottom = `${(parseFloat(content.dataset.naturalBottom) || 0) + lift}px`;
        if (cta) cta.style.bottom = `${(parseFloat(cta.dataset.naturalBottom) || 0) + lift}px`;
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
    window.addEventListener('resize', schedule);
    desktop.addEventListener('change', schedule);
    reduced.addEventListener('change', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
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
