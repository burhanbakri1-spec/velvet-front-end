import { useEffect, useLayoutEffect, useState } from 'react';
import IntroLoader from '../components/IntroLoader';
import Header from '../components/Header';
import Hero from '../components/Hero';
import IntroSection from '../components/IntroSection';
import BrandShowcase from '../components/BrandShowcase';
import BrandBannerStack from '../components/BrandBannerStack';
import { BRAND_BANNER_STACK } from '../components/brandBannerMetrics';
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
  const [stackOpen, setStackOpen] = useState(false);
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
    const motion = { y: window.scrollY, accum: 0, revealed: false, suspendUntil: 0 };
    const threshold = BRAND_BANNER_STACK.scrollThreshold;

    const sync = () => {
      const enabled = desktop.matches && !reduced.matches;
      if (!enabled) {
        motion.revealed = false;
        motion.accum = 0;
        root.removeAttribute('data-stack-open');
        root.style.setProperty('--brand-rail-height', '0px');
        setStackOpen((current) => (current ? false : current));
        setActiveBrand((current) => (current === 0 ? current : 0));
        return;
      }
      const y = window.scrollY;
      const delta = y - motion.y;
      motion.y = y;
      if (performance.now() < motion.suspendUntil) {
        motion.accum = motion.revealed ? -threshold : Math.max(0, motion.accum);
      } else if (delta !== 0) {
        motion.accum = motion.accum !== 0 && Math.sign(delta) !== Math.sign(motion.accum) ? delta : motion.accum + delta;
      }
      if (y <= 4 || motion.accum >= threshold) {
        motion.revealed = false;
        if (motion.accum > threshold) motion.accum = threshold;
      } else if (motion.accum <= -threshold) {
        motion.revealed = true;
        if (motion.accum < -threshold) motion.accum = -threshold;
      }
      const sections = [...root.querySelectorAll(':scope > .home-brand')];
      const tops = sections.map((section) => section.querySelector(':scope > .brand-showcase')?.getBoundingClientRect().top ?? 0);
      const cluster = tops.length ? Math.min(...tops) : 0;
      let active = 0;
      tops.forEach((top, index) => {
        if (top <= cluster + 2) active = index;
      });
      const stripOverlaps = (section) => {
        const strip = section?.querySelector(':scope > .brand-strip');
        if (!strip) return false;
        const rect = strip.getBoundingClientRect();
        return rect.bottom > cluster + 24 && rect.top < window.innerHeight - 48;
      };
      while (active > 0 && stripOverlaps(sections[active - 1]) && !stripOverlaps(sections[active])) active -= 1;
      const stackOpen = motion.revealed && active > 0;
      root.style.setProperty('--brand-rail-height', '0px');
      if (stackOpen) root.setAttribute('data-stack-open', '');
      else root.removeAttribute('data-stack-open');
      setStackOpen((current) => (current === stackOpen ? current : stackOpen));
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
          <BrandBannerStack brands={brands.slice(0, activeBrand)} />
          {brands.map((brand, index) => (
            <section className="home-brand" data-active={index === activeBrand ? 'true' : undefined} key={brand.slug}>
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
                concealed={stackOpen && index === activeBrand}
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
