import { useI18n } from '../i18n/I18nContext';

export default function CompanyCareersCta() {
  const { copy, locale } = useI18n();
  return (
    <section className="company-careers-cta">
      <span className="store-eyebrow">{copy.about.careersEyebrow}</span>
      <h2>{copy.about.careersTitle[0]}<br />{copy.about.careersTitle[1]}</h2>
      <a className="store-primary-button" href="#footer">{copy.about.careersCta} <span>{locale === 'ar' ? '←' : '→'}</span></a>
    </section>
  );
}
