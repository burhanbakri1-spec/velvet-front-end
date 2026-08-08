import { useI18n } from '../i18n/I18nContext';

export default function EditorialSplit({ section }) {
  const { locale } = useI18n();
  return (
    <section className={`editorial-split ${section.reverse ? 'editorial-split--reverse' : ''}`} style={{ '--section-height': `${section.height}px` }}>
      <div className="editorial-split__copy">
        <span className="store-eyebrow">{locale === 'ar' ? section.eyebrowAr : section.eyebrow}</span>
        <h2>{locale === 'ar' ? section.titleAr : section.title}</h2>
        {(locale === 'ar' ? section.paragraphsAr : section.paragraphs).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      <figure className="editorial-split__media"><img src={section.image} alt="" /></figure>
    </section>
  );
}
