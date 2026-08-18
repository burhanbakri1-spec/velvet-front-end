import { Link, localizePath, useRouter } from '../routing/Router';
import { useI18n } from '../i18n/I18nContext';

/**
 * Shared Back / Home / Breadcrumb navigation for storefront pages.
 * Props:
 *   fallbackPath – unlocalized path to navigate when no browser history (e.g. "/products")
 *   breadcrumbs  – array of { label, to } (to is unlocalized, last item has no link)
 */
export default function PageNavigation({ fallbackPath = '/', breadcrumbs = [] }) {
  const { locale } = useI18n();
  const { navigate } = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate(localizePath(fallbackPath, locale));
    }
  };

  const isRtl = locale === 'ar';
  const backArrow = isRtl ? '→' : '←';
  const separator = isRtl ? '\\' : '/';

  return (
    <nav className="page-nav" aria-label="Page navigation">
      <div className="page-nav__actions">
        <button type="button" className="page-nav__back" onClick={handleBack} aria-label={isRtl ? 'رجوع' : 'Go back'}>
          {backArrow}
        </button>
        <Link className="page-nav__home" to="/" aria-label={isRtl ? 'الرئيسية' : 'Home'}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8l6-6 6 6M4 7v6a1 1 0 001 1h2V10h2v4h2a1 1 0 001-1V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      </div>
      {breadcrumbs.length > 0 && (
        <ol className="page-nav__breadcrumb">
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <li key={i}>
                {i > 0 && <span className="page-nav__sep" aria-hidden="true">{separator}</span>}
                {isLast || !crumb.to ? (
                  <span aria-current="page">{crumb.label}</span>
                ) : (
                  <Link to={crumb.to}>{crumb.label}</Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
