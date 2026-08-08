import { useState } from 'react';
import PageVideoHero from '../components/PageVideoHero';
import { useI18n } from '../i18n/I18nContext';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const { copy, locale } = useI18n();
  const handleSubmit = (event) => { event.preventDefault(); setSubmitted(true); };

  return (
    <div className="contact-page">
      <PageVideoHero title={copy.contact.title} eyebrow={copy.contact.eyebrow} poster="/media/poster-contact.jpg" theme="contact" overlay={0.4} />
      <section className="contact-form-section">
        <div className="contact-form-intro">
          <span className="store-eyebrow">{copy.contact.talk}</span>
          <h2>{copy.contact.heading}</h2>
          <p>{copy.contact.intro}</p>
        </div>
        <form className="contact-form" onSubmit={handleSubmit}>
          <label><span>{copy.contact.name}</span><input name="name" required placeholder={copy.contact.namePlaceholder} /></label>
          <label><span>{copy.contact.email}</span><input name="email" required type="email" dir="ltr" placeholder={copy.contact.emailPlaceholder} /></label>
          <label className="contact-form__wide"><span>{copy.contact.subject}</span><select name="subject" required defaultValue=""><option value="" disabled>{copy.contact.choose}</option><option value="product">{copy.contact.product}</option><option value="order">{copy.contact.order}</option><option value="press">{copy.contact.press}</option><option value="general">{copy.contact.general}</option></select></label>
          <label className="contact-form__wide"><span>{copy.contact.message}</span><textarea name="message" required rows="6" placeholder={copy.contact.messagePlaceholder} /></label>
          <div className="contact-form__actions"><button className="store-primary-button" type="submit">{copy.contact.submit} <i>{locale === 'ar' ? '←' : '→'}</i></button>{submitted && <p role="status">{copy.contact.success}</p>}</div>
        </form>
      </section>
    </div>
  );
}
