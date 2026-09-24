import { socialLinkOrder, socialLinks } from '../data/socialLinks';
import { useI18n } from '../i18n/I18nContext';

const SOCIAL_ICONS = {
  whatsapp: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.82c0 1.97.55 3.8 1.5 5.37L2 22l4.98-1.55a10 10 0 0 0 5.06 1.37h.01c5.46 0 9.89-4.4 9.89-9.82S17.5 2 12.04 2Zm5.54 14.01c-.23.65-1.35 1.2-1.88 1.27-.48.07-1.1.1-1.77-.11-.41-.12-.93-.3-1.6-.59-2.82-1.22-4.65-4.05-4.79-4.24-.14-.19-1.15-1.53-1.15-2.92 0-1.39.73-2.07.99-2.35.26-.28.57-.35.76-.35h.55c.18 0 .41-.05.64.49.23.55.79 1.9.86 2.04.07.14.11.3.02.49-.09.19-.14.3-.28.46-.14.16-.3.36-.42.48-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.21 1.37.28.14.44.12.6-.07.16-.19.7-.81.89-1.09.19-.28.37-.23.64-.14.26.09 1.68.79 1.97.94.28.14.47.21.54.33.07.12.07.7-.16 1.35Z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 9h3V6h-3c-1.9 0-3.5 1.6-3.5 3.5V12H8v3h2.5v7h3v-7H16l.5-3H13.5v-1.5c0-.8.4-1.5.5-1.5Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Zm9.2 1.3a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 8.2A3.8 3.8 0 1 1 12 15.8 3.8 3.8 0 0 1 12 8.2Zm0 2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.5 3c.5 2.4 2.1 4.1 4.5 4.5V10c-1.7.05-3.2-.45-4.5-1.4v6.5A5.6 5.6 0 1 1 10 9.6v2.2a3.4 3.4 0 1 0 2.4 3.25V3h3.1Z" />
    </svg>
  ),
};

export default function ContactSocialLinks() {
  const { copy } = useI18n();

  return (
    <section className="contact-social" aria-labelledby="contact-social-title">
      <div className="contact-social__copy">
        <span className="store-eyebrow">{copy.contact.socialEyebrow}</span>
        <h2 id="contact-social-title">{copy.contact.socialTitle}</h2>
        <p>{copy.contact.socialIntro}</p>
      </div>
      <ul className="contact-social__list">
        {socialLinkOrder.map((key) => (
          <li key={key}>
            <a
              className={`contact-social__link contact-social__link--${key}`}
              href={socialLinks[key]}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="contact-social__icon">{SOCIAL_ICONS[key]}</span>
              <span className="contact-social__label">{copy.footer[key]}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
