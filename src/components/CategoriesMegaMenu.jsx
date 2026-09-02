import { useEffect, useState } from 'react';
import { getBrandMedia, velvetBrands } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { localizePath, useRouter } from '../routing/Router';

export default function CategoriesMegaMenu({ open, onClose, brand: contextBrand }) {
  const { copy, locale } = useI18n();
  const { navigate } = useRouter();
  const defaultSlug = contextBrand?.slug || velvetBrands[0]?.slug || '';
  const [activeBrand, setActiveBrand] = useState(defaultSlug);

  useEffect(() => {
    if (!open) return;
    setActiveBrand(contextBrand?.slug || velvetBrands[0]?.slug || '');
  }, [open, contextBrand?.slug]);

  const brand = velvetBrands.find((item) => item.slug === activeBrand) || velvetBrands[0];
  const preview = brand ? getBrandMedia(brand.slug) : { poster: '', video: '' };

  const selectBrand = (slug) => setActiveBrand(slug);
  const goBrand = (slug) => {
    selectBrand(slug);
    navigate(localizePath(`/brands/${slug}`, locale));
    onClose();
  };

  return (
    <div className={`mega-menu mega-menu--brands ${open ? 'is-open' : ''}`} aria-hidden={!open} data-mega-menu="brands">
      <div className="mega-menu__links mega-cascade mega-cascade--brands-only">
        <nav className="mega-cascade__col mega-cascade__col--brands" aria-label={copy.shop.brand} data-mega-brand-list>
          <span className="mega-cascade__col-title">{copy.shop.brand}</span>
          {velvetBrands.map((item) => (
            <button
              type="button"
              className={item.slug === brand?.slug ? 'is-active' : ''}
              key={item.slug}
              data-brand-slug={item.slug}
              onMouseEnter={() => selectBrand(item.slug)}
              onFocus={() => selectBrand(item.slug)}
              onClick={() => goBrand(item.slug)}
            >
              {item.name[locale]}
            </button>
          ))}
        </nav>
      </div>
      {brand && (
        <button
          type="button"
          className="mega-menu__preview"
          onClick={() => goBrand(brand.slug)}
          aria-label={brand.name[locale]}
          data-mega-brand-preview={brand.slug}
        >
          {preview.poster ? (
            <img className="mega-menu__preview-media" src={preview.poster} alt="" />
          ) : (
            <span className="mega-menu__preview-fallback" aria-hidden="true" />
          )}
          <span className="mega-menu__preview-shade" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
