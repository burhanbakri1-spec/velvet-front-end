import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';

export default function IntroSection() {
  const { copy, locale } = useI18n();
  const arrow = locale === 'ar' ? '←' : '→';

  // Stay on Home and glide to the brand showcase instead of routing away.
  const scrollToShowcases = (event) => {
    event.preventDefault();
    document.getElementById('showcases')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="intro-section" id="about">
      <h2>{copy.home.introTitle[0]}<br />{copy.home.introTitle[1]}</h2>
      <div className="intro-section__body">
        <p>{copy.home.introP1}</p>
        <p>{copy.home.introP2}</p>
        <div className="intro-ctas">
          <Link className="intro-cta intro-cta--primary" to="#showcases" onClick={scrollToShowcases}>
            <span className="intro-cta__copy">
              <span className="intro-cta__label">{copy.home.meet}</span>
              <span className="intro-cta__meta">{copy.home.exploreMeta}</span>
            </span>
            <span className="intro-cta__icon" aria-hidden="true">{arrow}</span>
          </Link>
          <Link className="intro-cta intro-cta--accent" to="/products">
            <span className="intro-cta__copy">
              <span className="intro-cta__label">{copy.home.shopNow}</span>
              <span className="intro-cta__meta">{copy.home.shopMeta}</span>
            </span>
            <span className="intro-cta__icon" aria-hidden="true">{arrow}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
