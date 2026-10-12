import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import IntroLoader from '../components/IntroLoader';
import Header from '../components/Header';
import Hero from '../components/Hero';
import IntroSection from '../components/IntroSection';
import BrandShowcase from '../components/BrandShowcase';
import { heroStageMotion, stepHeroScrollDirection } from '../components/heroScrollProgress';
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
    const direction = { y: window.scrollY, accum: 0, mode: 'down' };

    const readShift = (hero) => {
      const transform = hero ? getComputedStyle(hero).transform : '';
      if (!transform || transform === 'none') return 0;
      const values = transform.slice(transform.indexOf('(') + 1, -1).split(',').map(Number);
      return values.length === 16 ? values[13] : values[5] || 0;
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
        strip?.classList.remove('is-concealed');
        section.removeAttribute('data-active');
      });
    };

    const sync = () => {
      const enabled = desktop.matches && !reduced.matches;
      if (!enabled) {
        direction.mode = 'down';
        direction.accum = 0;
        direction.y = window.scrollY;
        clearMotion();
        return;
      }
      const y = window.scrollY;
      const delta = y - direction.y;
      direction.y = y;
      const nextDirection = stepHeroScrollDirection(direction, delta);
      direction.mode = nextDirection.mode;
      direction.accum = nextDirection.accum;
      if (direction.mode !== 'up') {
        clearMotion();
        return;
      }
      const sections = [...root.querySelectorAll(':scope > .home-brand')];
      const heroes = sections.map((section) => {
        const hero = section.querySelector(':scope > .brand-showcase');
        const shift = readShift(hero);
        const rect = hero?.getBoundingClientRect();
        return {
          top: rect ? rect.top + window.scrollY - shift : 0,
          height: rect ? rect.height : 0,
        };
      });
      const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 88;
      const motion = heroStageMotion({
        heroes,
        scrollY: window.scrollY,
        header,
        viewportHeight: window.innerHeight,
      });
      let active = 0;
      const visualTops = heroes.map((hero, index) => hero.top - window.scrollY + (motion[index]?.shift || 0));
      visualTops.forEach((top, index) => {
        if (top <= header + 2) active = index;
      });
      sections.forEach((section, index) => {
        const hero = section.querySelector(':scope > .brand-showcase');
        const strip = section.querySelector(':scope > .brand-strip');
        const shift = motion[index]?.shift || 0;
        const clip = motion[index]?.clip || 0;
        if (hero) {
          hero.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : '';
          hero.style.clipPath = clip ? `inset(0 0 ${clip}px 0)` : '';
        }
        strip?.classList.toggle('is-concealed', Boolean(motion[index]?.stripHidden));
        section.toggleAttribute('data-active', index === active);
      });
      root.style.setProperty('--brand-rail-height', '0px');
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

    syncHeroes.current = sync;
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
