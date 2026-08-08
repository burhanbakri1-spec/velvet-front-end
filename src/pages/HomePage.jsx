import { useEffect, useState } from 'react';
import IntroLoader from '../components/IntroLoader';
import Header from '../components/Header';
import Hero from '../components/Hero';
import IntroSection from '../components/IntroSection';
import BrandShowcase from '../components/BrandShowcase';
import CareersSection from '../components/CareersSection';
import Footer from '../components/Footer';
import { homeCategories } from '../data/products';
import { useI18n } from '../i18n/I18nContext';

export default function HomePage() {
  const previewTarget = new URLSearchParams(window.location.search).get('view');
  const [introActive, setIntroActive] = useState(!previewTarget);
  const { copy } = useI18n();

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
        <section id="showcases" aria-label={copy.home.worlds}>
          {homeCategories.map((category) => (
            <BrandShowcase
              brand={{ ...category, image: category.heroImage, palette: category.home.palette, scene: category.home.scene }}
              key={category.id}
            />
          ))}
        </section>
        <CareersSection />
      </main>
      <Footer />
    </>
  );
}
