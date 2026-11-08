import { Link } from '../routing/Router';
import { useI18n } from '../i18n/I18nContext';
import { formatCanonicalAgeRange, getCanonicalAgeGroups } from '../data/ageBrowse';

export default function AgeGroupCards({ asSection = true }) {
  const { copy, locale } = useI18n();
  const groups = getCanonicalAgeGroups();
  const content = (
    <div className="age-groups__inner">
      <header className="age-groups__header">
        <p className="age-groups__eyebrow">{copy.home.ageEyebrow}</p>
        <h2 id="shop-by-age-title">{copy.home.ageBuyerTitle}</h2>
        <p>{copy.home.ageIntro}</p>
      </header>
      <div className="age-groups__grid">
        {groups.map((group, index) => (
          <Link
            className={`age-group-card age-group-card--${index + 1}`}
            data-age-id={group.id}
            to={`/shop-by-age/${encodeURIComponent(group.id)}`}
            key={group.id}
            aria-label={`${copy.home.shopByAge}: ${group.name[locale]}`}
          >
            <span className="age-group-card__index" aria-hidden="true">0{index + 1}</span>
            <span className={`age-group-card__toy-mark age-group-card__toy-mark--${index + 1}`} aria-hidden="true">
              <i /><i /><i />
            </span>
            <span className="age-group-card__range" aria-hidden="true">
              <strong>{formatCanonicalAgeRange(group.id)}</strong>
              <small>{copy.home.ageUnit}</small>
            </span>
            <span className="age-group-card__action">{copy.home.ageExplore}<b aria-hidden="true">{locale === 'ar' ? '←' : '→'}</b></span>
          </Link>
        ))}
      </div>
    </div>
  );

  return asSection
    ? <section className="age-groups" aria-labelledby="shop-by-age-title" id="shop-by-age">{content}</section>
    : <section className="age-groups age-groups--index" aria-labelledby="shop-by-age-title">{content}</section>;
}
