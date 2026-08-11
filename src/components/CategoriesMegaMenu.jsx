import { useState } from 'react';
import { velvetBrands } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';
import { shopHref } from '../hooks/useShopState';

export default function CategoriesMegaMenu({ open, onClose }) {
  const { copy, locale } = useI18n();
  const [activeBrand, setActiveBrand] = useState(velvetBrands[0].slug);
  const brand = velvetBrands.find((item) => item.slug === activeBrand) || velvetBrands[0];
  const [activeCategory, setActiveCategory] = useState(brand.categories[0].slug);
  const category = brand.categories.find((item) => item.slug === activeCategory) || brand.categories[0];

  return (
    <div className={`mega-menu ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="mega-menu__links mega-cascade">
        <nav className="mega-cascade__col mega-cascade__col--brands" aria-label={copy.shop.brand}>
          <span className="mega-cascade__col-title">{copy.shop.brand}</span>
          {velvetBrands.map((item) => (
            <button
              type="button"
              className={item.slug === brand.slug ? 'is-active' : ''}
              key={item.slug}
              onMouseEnter={() => { setActiveBrand(item.slug); setActiveCategory(item.categories[0].slug); }}
              onFocus={() => { setActiveBrand(item.slug); setActiveCategory(item.categories[0].slug); }}
              onClick={() => { setActiveBrand(item.slug); setActiveCategory(item.categories[0].slug); }}
            >
              {item.name[locale]}
            </button>
          ))}
        </nav>
        <nav className="mega-cascade__col" aria-label={copy.shop.category}>
          <span className="mega-cascade__col-title">{copy.shop.category}</span>
          <Link to={shopHref({ brand: brand.slug }, locale)} onClick={onClose}>{copy.shop.allCategories}</Link>
          {brand.categories.map((item) => (
            <button
              type="button"
              className={item.slug === category.slug ? 'is-active' : ''}
              key={item.slug}
              onMouseEnter={() => setActiveCategory(item.slug)}
              onFocus={() => setActiveCategory(item.slug)}
              onClick={() => setActiveCategory(item.slug)}
            >
              {item.name[locale]}
            </button>
          ))}
        </nav>
        <nav className="mega-cascade__col" aria-label={copy.shop.subcategory}>
          <span className="mega-cascade__col-title">{copy.shop.subcategory}</span>
          <Link to={shopHref({ brand: brand.slug, category: category.slug }, locale)} onClick={onClose}>{copy.shop.allSubcategories}</Link>
          {category.subs.map((item) => (
            <Link to={shopHref({ brand: brand.slug, category: category.slug, subcategory: item.slug }, locale)} onClick={onClose} key={item.slug}>
              {item.name[locale]}
            </Link>
          ))}
        </nav>
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
