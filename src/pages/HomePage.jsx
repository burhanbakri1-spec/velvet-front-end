import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import IntroLoader from '../components/IntroLoader';
import Header from '../components/Header';
import Hero from '../components/Hero';
import IntroSection from '../components/IntroSection';
import BrandShowcase from '../components/BrandShowcase';
import { heroStageMotion, latchStageMode, stageGeometry, stageSlidePos, stepHeroDirection } from '../components/heroScrollProgress';
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
    const direction = { y: window.scrollY, mode: 'down', pos: 0 };
    let shellTop = 0;
    let stageHeight = 812;
    let headerOffset = 88;
    let slides = [];

    const clearMotion = () => {
      root.style.setProperty('--brand-rail-height', '0px');
      document.body.classList.remove('hero-stage-pin');
      root.querySelector('.hero-stage-shell')?.style.removeProperty('--hero-stage-span');
      const stage = root.querySelector('.hero-stage');
      if (stage) {
        stage.style.top = '';
        stage.style.height = '';
      }
      root.querySelectorAll('.home-brand').forEach((section) => {
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
      const shell = root.querySelector('.hero-stage-shell');
      const stage = root.querySelector('.hero-stage');
      headerOffset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 88;
      stageHeight = Math.max(1, Math.round(window.innerHeight - headerOffset));
      slides = [];
      stage?.querySelectorAll(':scope > .home-brand').forEach((section, heroIndex) => {
        const hero = section.querySelector(':scope > .brand-showcase');
        const strip = section.querySelector(':scope > .brand-strip');
        if (hero) slides.push({ kind: 'hero', heroIndex, el: hero, section });
        if (strip) {
          const height = strip.offsetHeight;
          slides.push({
            kind: 'strip',
            heroIndex,
            el: strip,
            section,
            height: height > 0 ? height : undefined,
          });
        }
      });
      if (shell) shellTop = shell.getBoundingClientRect().top + window.scrollY;
      const stageEl = root.querySelector('.hero-stage');
      const enabled = desktop.matches && !reduced.matches && slides.length > 0;
      if (shell && stageEl && enabled) {
        const span = stageGeometry(slides, stageHeight).span + stageHeight;
        const nextSpan = `${span}px`;
        if (shell.style.getPropertyValue('--hero-stage-span') !== nextSpan) {
          shell.style.setProperty('--hero-stage-span', nextSpan);
        }
        stageEl.style.top = `${headerOffset}px`;
        stageEl.style.height = `${stageHeight}px`;
      } else if (shell || stageEl) {
        shell?.style.removeProperty('--hero-stage-span');
        if (stageEl) {
          stageEl.style.top = '';
          stageEl.style.height = '';
        }
      }
    };

    const apply = () => {
      const enabled = desktop.matches && !reduced.matches && slides.length > 0;
      if (!enabled) {
        direction.mode = 'down';
        direction.y = window.scrollY;
        clearMotion();
        return;
      }
      const y = window.scrollY;
      const delta = y - direction.y;
      const nextMode = stepHeroDirection(direction.mode, delta);
      const span = stageGeometry(slides, stageHeight).span;
      const local = Math.min(span, Math.max(0, y - (shellTop - headerOffset)));
      const pos = stageSlidePos(slides, local, stageHeight);
      direction.mode = latchStageMode(direction.mode, delta, direction.pos, pos, slides);
      if (direction.mode !== 'up') direction.mode = 'down';
      if (nextMode === direction.mode) direction.mode = nextMode;
      direction.pos = pos;
      direction.y = y;
      const motion = heroStageMotion({
        slides,
        local,
        stageHeight,
        mode: direction.mode,
      });
      const pin = y >= shellTop - headerOffset && y <= shellTop - headerOffset + span;
      if (document.body.classList.contains('hero-stage-pin') !== pin) {
        document.body.classList.toggle('hero-stage-pin', pin);
      }
      const activeHero = slides.reduce((best, slide, index) => (
        slide.kind === 'hero' && index <= Math.round(pos) ? slide.heroIndex : best
      ), 0);
      slides.forEach((slide, index) => {
        const pose = motion[index] || { y: stageHeight, clipTop: 0, clipBottom: 0, hidden: false, z: 1 };
        const clip = (pose.clipTop || pose.clipBottom) ? `inset(${pose.clipTop}px 0 ${pose.clipBottom}px 0)` : '';
        slide.el.style.transform = `translate3d(0, ${pose.y}px, 0)`;
        slide.el.style.clipPath = clip;
        slide.el.style.zIndex = String(pose.z || 1);
        if (slide.kind === 'strip') slide.el.classList.toggle('is-concealed', Boolean(pose.hidden));
        if (slide.kind === 'hero' && slide.heroIndex === activeHero) slide.section.setAttribute('data-active', '');
      });
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
    if (root.parentElement) observer.observe(root.parentElement);
    const stage = root.querySelector('.hero-stage');
    const stageObserver = new MutationObserver(onLayout);
    if (stage) stageObserver.observe(stage, { childList: true, subtree: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    stage?.addEventListener('load', onLayout, true);
    window.addEventListener('resize', onLayout);
    desktop.addEventListener('change', onLayout);
    reduced.addEventListener('change', onLayout);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      stage?.removeEventListener('load', onLayout, true);
      window.removeEventListener('resize', onLayout);
      observer.disconnect();
      stageObserver.disconnect();
      document.body.classList.remove('hero-stage-pin');
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
          <div className="hero-stage-shell">
            <div className="hero-stage">
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
            </div>
          </div>
        </section>
        <StoreReviewsSection />
        <CareersSection />
      </main>
      <Footer />
    </>
  );
}
