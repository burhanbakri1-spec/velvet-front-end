import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import IntroLoader from '../components/IntroLoader';
import Header from '../components/Header';
import Hero from '../components/Hero';
import IntroSection from '../components/IntroSection';
import BrandShowcase from '../components/BrandShowcase';
import { heroStageMotion, stepHeroDirection } from '../components/heroScrollProgress';
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
  const syncHeroes = useRef(() => {});

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
    let needsMeasure = true;
    const direction = { y: window.scrollY, mode: 'down' };
    let layout = [];

    const inlineShift = (hero) => {
      const match = /translate3d\(\s*0(?:px)?,\s*(-?\d+(?:\.\d+)?)px/i.exec(hero?.style.transform || '');
      return match ? Number(match[1]) : 0;
    };

    const clearMotion = () => {
      root.style.setProperty('--brand-rail-height', '0px');
      root.querySelectorAll(':scope > .home-brand').forEach((section) => {
        const hero = section.querySelector(':scope > .brand-showcase');
        const strip = section.querySelector(':scope > .brand-strip');
        if (hero) {
          hero.style.transform = '';
          hero.style.clipPath = '';
          hero.style.zIndex = '';
        }
        if (strip) {
          strip.style.transform = '';
          strip.classList.remove('is-concealed');
        }
        section.removeAttribute('data-active');
      });
    };

    const measure = () => {
      layout = [...root.querySelectorAll(':scope > .home-brand')].map((section) => {
        const hero = section.querySelector(':scope > .brand-showcase');
        if (!hero) return { top: 0, height: 0 };
        const rect = hero.getBoundingClientRect();
        return {
          top: rect.top + window.scrollY - inlineShift(hero),
          height: rect.height,
        };
      });
    };

    const apply = () => {
      const enabled = desktop.matches && !reduced.matches;
      if (!enabled) {
        direction.mode = 'down';
        direction.y = window.scrollY;
        clearMotion();
        return;
      }
      const y = window.scrollY;
      const delta = y - direction.y;
      const nextMode = stepHeroDirection(direction.mode, delta);
      direction.mode = nextMode;
      if (direction.mode !== 'up') direction.mode = 'down';
      direction.y = y;
      const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 88;
      const motion = heroStageMotion({
        heroes: layout,
        scrollY: y,
        header,
        viewportHeight: window.innerHeight,
        mode: direction.mode,
      });
      const focus = y + header;
      let active = 0;
      layout.forEach((hero, index) => {
        if (hero.top <= focus + 2) active = index;
      });
      const sections = [...root.querySelectorAll(':scope > .home-brand')];
      sections.forEach((section, index) => {
        const hero = section.querySelector(':scope > .brand-showcase');
        const strip = section.querySelector(':scope > .brand-strip');
        const shift = motion[index]?.shift || 0;
        const clip = motion[index]?.clip || 0;
        if (hero) {
          hero.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : '';
          const foot = motion[index]?.foot || 0;
          hero.style.clipPath = (clip || foot) ? `inset(${clip}px 0 ${foot}px 0)` : '';
          hero.style.zIndex = motion[index]?.z ? String(motion[index].z) : '';
        }
        if (strip) {
          strip.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : '';
          strip.classList.toggle('is-concealed', Boolean(motion[index]?.stripHidden));
        }
        section.toggleAttribute('data-active', index === active);
      });
      root.style.setProperty('--brand-rail-height', '0px');
    };

    const schedule = (measureFirst) => {
      needsMeasure = needsMeasure || measureFirst;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (needsMeasure) {
          needsMeasure = false;
          measure();
        }
        apply();
      });
    };

    const onScroll = () => schedule(false);
    const onLayout = () => schedule(true);
    syncHeroes.current = apply;
    measure();
    apply();
    const observer = new ResizeObserver(onLayout);
    root.querySelectorAll(':scope > .home-brand > .brand-showcase').forEach((hero) => observer.observe(hero));
    const header = document.querySelector('.site-header');
    const headerObserver = new MutationObserver(onLayout);
    if (header) headerObserver.observe(header, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onLayout);
    desktop.addEventListener('change', onLayout);
    reduced.addEventListener('change', onLayout);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onLayout);
      observer.disconnect();
      headerObserver.disconnect();
      desktop.removeEventListener('change', onLayout);
      reduced.removeEventListener('change', onLayout);
    };
  }, []);

  useLayoutEffect(() => {
    syncHeroes.current();
  });

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
              <BrandProductStrip
                brandSlug={brand.slug}
                deckIndex={index}
              />
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
