import { productCategories } from '../data/products';
import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';

export default function CategoriesMegaMenu({ open, onClose }) {
  const { copy, locale } = useI18n();
  const columns = [productCategories.slice(0, 3), productCategories.slice(3, 6), productCategories.slice(6)];
  return (
    <div className={`mega-menu ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="mega-menu__links">
        {columns.map((column, index) => (
          <div className="mega-menu__column" key={index}>
            {column.map((category) => (
              <Link to={category.id === 'all' ? '/products' : `/categories/${category.slug}`} onClick={onClose} key={category.id}>{category.name[locale]}</Link>
            ))}
          </div>
        ))}
      </div>
      <Link className="mega-menu__feature" to="/products" onClick={onClose}>
        <span className="mega-menu__eyebrow">{copy.categoryMenu.eyebrow}</span>
        <strong>{copy.categoryMenu.all}</strong>
        <span className="mega-menu__product" aria-hidden="true"><i /><i /><i /></span>
        <span className="mega-menu__cta">{copy.categoryMenu.explore} <b>{locale === 'ar' ? '←' : '→'}</b></span>
      </Link>
    </div>
  );
}
