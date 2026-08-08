import { useI18n } from '../i18n/I18nContext';

export default function IntroSection() {
  const { copy, locale } = useI18n();
  return (
    <section className="intro-section" id="about">
      <h2>{copy.home.introTitle[0]}<br />{copy.home.introTitle[1]}</h2>
      <div className="intro-section__body">
        <p>{copy.home.introP1}</p>
        <p>{copy.home.introP2}</p>
        <a href="#showcases">{copy.home.meet} <span>{locale === 'ar' ? '←' : '→'}</span></a>
      </div>
    </section>
  );
}
