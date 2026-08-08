import { useI18n } from '../i18n/I18nContext';

export default function CareersSection() {
  const { copy, locale } = useI18n();
  return (
    <section className="careers-section" id="careers">
      <div>
        <span className="eyebrow">{copy.home.careersEyebrow}</span>
        <h2>{copy.home.careersTitle[0]}<br />{copy.home.careersTitle[1]}</h2>
      </div>
      <p>{copy.home.careersBody}</p>
      <a href="#footer">{copy.home.careersCta} <span>{locale === 'ar' ? '←' : '→'}</span></a>
    </section>
  );
}
