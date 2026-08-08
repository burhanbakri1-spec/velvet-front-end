import { Link } from '../routing/Router';
import { useI18n } from '../i18n/I18nContext';

const links = [
  { key: 'about', to: '/about' },
  { key: 'news', to: '/news' },
  { key: 'contact', to: '/contact' },
];

export default function AboutSubnav({ open, onClose }) {
  const { copy } = useI18n();
  return (
    <div className={`about-subnav ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      {links.map((link) => (
        <Link to={link.to} onClick={onClose} key={link.to}>
          <span>{copy.aboutNav[link.key]}</span>
        </Link>
      ))}
    </div>
  );
}
