import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';

const groups = [
  { title: 'explore', links: [{ key: 'home', to: '/' }, { key: 'products', to: '/products' }, { key: 'news', to: '/news' }] },
  { title: 'company', links: [{ key: 'about', to: '/about' }, { key: 'contact', to: '/contact' }] },
  { title: 'follow', links: [{ key: 'instagram' }, { key: 'linkedin' }, { key: 'tiktok' }, { key: 'youtube' }] },
  { title: 'policies', links: [{ key: 'terms' }, { key: 'privacy' }, { key: 'cookies' }, { key: 'accessibility' }] },
];

export default function Footer() {
  const { copy, locale } = useI18n();
  return (
    <footer className="footer" id="footer">
      <div className="footer__callout">
        <h2>{copy.footer.callout}</h2>
        <a href="#top">{copy.footer.opportunities} <span>{locale === 'ar' ? '←' : '→'}</span></a>
      </div>
      <div className="footer__body">
        <div className="footer__brand"><span>VELVET</span><p>{copy.footer.tagline}</p></div>
        <div className="footer__groups">
          {groups.map((group) => (
            <div key={group.title}>
              <h3>{copy.footer[group.title]}</h3>
              {group.links.map((link) => link.to
                ? <Link to={link.to} key={link.key}>{copy.footer[link.key]}</Link>
                : <a href="#top" key={link.key}>{copy.footer[link.key]}</a>)}
            </div>
          ))}
        </div>
      </div>
      <div className="footer__bottom"><span>{copy.footer.copyright}</span><span>{copy.footer.note}</span></div>
    </footer>
  );
}
