import { Link } from '../routing/Router';
import { useI18n } from '../i18n/I18nContext';

/**
 * Sticky storefront context bar with an explicit VELVET Home return path.
 * Props:
 *   fallbackPath – unused for primary return (kept for call-site compatibility)
 *   breadcrumbs  – array of { label, to } (to is unlocalized; last item may omit to)
 */
export default function PageNavigation({ fallbackPath = '/', breadcrumbs = [] }) {
  const { copy, locale } = useI18n();
  const isRtl = locale === 'ar';
  const separator = isRtl ? '\\' : '/';
  const homeLabel = copy.meta.velvetHome;
  const homeArrow = isRtl ? '→' : '←';

  const contextualCrumbs = (breadcrumbs || []).filter((crumb) => {
    if (!crumb?.label) return false;
    const label = String(crumb.label).trim().toLowerCase();
    const homeAliases = [copy.meta.home, homeLabel, 'home', 'الرئيسية']
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    if (crumb.to === '/' && homeAliases.includes(label)) return false;
    return true;
  });

  const trail = [{ label: homeLabel, to: '/' }, ...contextualCrumbs];
  const current = trail[trail.length - 1];

  return (
    <nav className="page-nav page-nav--sticky" aria-label={homeLabel}>
      <div className="page-nav__mobile">
        <Link className="page-nav__velvet-home" to="/" aria-label={homeLabel}>
          <span className="page-nav__velvet-home-arrow" aria-hidden="true">{homeArrow}</span>
          <span>{homeLabel}</span>
        </Link>
        {current?.to !== '/' && current?.label ? (
          <span className="page-nav__mobile-current" aria-current="page">{current.label}</span>
        ) : null}
      </div>

      <ol className="page-nav__breadcrumb page-nav__breadcrumb--desktop">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={`${crumb.label}-${index}`}>
              {index > 0 && <span className="page-nav__sep" aria-hidden="true">{separator}</span>}
              {isLast || !crumb.to ? (
                <span aria-current={isLast ? 'page' : undefined}>{crumb.label}</span>
              ) : (
                <Link to={crumb.to}>{crumb.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
