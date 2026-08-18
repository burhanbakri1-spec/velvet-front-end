import { useState } from 'react';
import { velvetBrands } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { Link, localizePath, useRouter } from '../routing/Router';
import { buildShopQuery } from '../hooks/useShopState';

const shopPath = (state) => {
  const query = buildShopQuery(state);
  return `/products${query ? `?${query}` : ''}`;
};

export default function CategoriesMegaMenu({ open, onClose, brand: contextBrand }) {
  const { copy, locale } = useI18n();
  const { navigate } = useRouter();
  const scoped = Boolean(contextBrand);
  const [activeBrand, setActiveBrand] = useState(velvetBrands[0]?.slug || '');
  const brand = scoped ? contextBrand : (velvetBrands.find((item) => item.slug === activeBrand) || velvetBrands[0]);
  const [activeCategory, setActiveCategory] = useState(brand?.categories[0]?.slug || '');
  const category = brand?.categories.find((item) => item.slug === activeCategory) || brand?.categories[0] || null;

  const selectBrand = (slug) => {
    const next = velvetBrands.find((item) => item.slug === slug) || velvetBrands[0];
    setActiveBrand(next?.slug || '');
    setActiveCategory(next?.categories[0]?.slug || '');
  };
  const goBrand = (slug) => {
    selectBrand(slug);
    navigate(localizePath(shopPath({ brand: slug }), locale));
    onClose();
  };
  const goCategory = (slug) => {
    setActiveCategory(slug);
    navigate(localizePath(shopPath({ brand: brand.slug, category: slug }), locale));
    onClose();
  };

  return (
    <div className={`mega-menu ${scoped ? 'mega-menu--scoped' : ''} ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="mega-menu__links mega-cascade">
        {!scoped && (
          <nav className="mega-cascade__col mega-cascade__col--brands" aria-label={copy.shop.brand}>
            <span className="mega-cascade__col-title">{copy.shop.brand}</span>
            {velvetBrands.map((item) => (
              <button
                type="button"
                className={item.slug === brand.slug ? 'is-active' : ''}
                key={item.slug}
                onMouseEnter={() => selectBrand(item.slug)}
                onFocus={() => selectBrand(item.slug)}
                onClick={() => goBrand(item.slug)}
              >
                {item.name[locale]}
              </button>
            ))}
          </nav>
        )}
        <nav className="mega-cascade__col" aria-label={copy.shop.category}>
          <span className="mega-cascade__col-title">{copy.shop.category}</span>
          {brand.categories.map((item) => (
            <button
              type="button"
              className={item.slug === category.slug ? 'is-active' : ''}
              key={item.slug}
              onMouseEnter={() => setActiveCategory(item.slug)}
              onFocus={() => setActiveCategory(item.slug)}
              onClick={() => goCategory(item.slug)}
            >
              {item.name[locale]}
            </button>
          ))}
        </nav>
        <nav className="mega-cascade__col" aria-label={copy.shop.subcategory}>
          <span className="mega-cascade__col-title">{copy.shop.subcategory}</span>
          {(category?.subs || []).map((item) => (
            <Link to={shopPath({ brand: brand.slug, category: category.slug, subcategory: item.slug })} onClick={onClose} key={item.slug}>
              {item.name[locale]}
            </Link>
          ))}
        </nav>
      </div>
      <Link className="mega-menu__feature" to={scoped ? shopPath({ brand: brand.slug }) : '/products'} onClick={onClose}>
        <span className="mega-menu__eyebrow">{copy.categoryMenu.eyebrow}</span>
        <strong>{copy.categoryMenu.all}</strong>
        <span className="mega-menu__product" aria-hidden="true"><i /><i /><i /></span>
        <span className="mega-menu__cta">{copy.categoryMenu.explore} <b>{locale === 'ar' ? '←' : '→'}</b></span>
      </Link>
    </div>
  );
}
