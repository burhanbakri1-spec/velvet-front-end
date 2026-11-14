import { useEffect, useState } from 'react';
import IntroLoader from '../components/IntroLoader';
import Header from '../components/Header';
import Hero from '../components/Hero';
import IntroSection from '../components/IntroSection';
import BrandShowcase from '../components/BrandShowcase';
import { useHeroStageMotion } from '../components/useHeroStageMotion';
import BrandProductStrip from '../components/BrandProductStrip';
import AgeGroupCards from '../components/AgeGroupCards';
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
  useHeroStageMotion('showcases', true);

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
        <AgeGroupCards />
        <section id="showcases" data-home-brand-deck aria-label={copy.home.worlds}>
          <div className="hero-stage-shell">
            <div className="hero-stage">
          {brands.map((brand, index) => (
            <section className="home-brand" key={brand.slug}>
              <div className="home-brand__banner-layer">
                <BrandShowcase
                  variant="full-banner"
                  showBrandLogo
                  deckIndex={index}
                  // The reverse stack keeps every earlier poster/logo visible;
                  // eager fetching prevents a newly exposed card from waiting
                  // on a lazy image request. Decoding remains asynchronous.
                  mediaLoading="eager"
                  mediaFetchPriority={index === 0 ? 'high' : undefined}
                  brand={{ ...brand, image: brand.image, palette: brand.home.palette, scene: brand.home.scene }}
                />
                <div className="home-brand__runway" aria-hidden="true" />
              </div>
              <div className="home-brand__product-layer">
                <BrandProductStrip
                  brandSlug={brand.slug}
                  deckIndex={index}
                />
              </div>
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
