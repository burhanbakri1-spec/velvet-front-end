import { useMemo } from 'react';
import { getCategory, getSubcategory, velvetBrands } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';

export default function TreeMap({ state, onSelect }) {
  const { copy, locale } = useI18n();
  const s = copy.shop;

  const brand = useMemo(() => (state.brand ? velvetBrands.find((item) => item.slug === state.brand) || null : null), [state.brand]);
  const category = useMemo(() => (brand && state.category ? getCategory(brand.slug, state.category) : null), [brand, state.category]);
  const sub = useMemo(() => (category && state.subcategory ? getSubcategory(brand.slug, category.slug, state.subcategory) : null), [brand, category, state.subcategory]);

  return (
    <section className="map" aria-label={s.treeMap}>
      <h3>{s.treeMap}</h3>
      <div className="map-brands">
        {velvetBrands.map((item) => (
          <button
            type="button"
            className={`map-brand ${item.slug === state.brand ? 'is-active' : ''}`}
            style={{ borderColor: item.color }}
            key={item.slug}
            onClick={() => onSelect('brand', item.slug)}
          >
            {item.name[locale]}
          </button>
        ))}
      </div>
      {brand ? (
        <>
          <div className="map-cats">
            {brand.categories.map((item) => (
              <button
                type="button"
                className={`map-cat ${item.slug === state.category ? 'is-active' : ''}`}
                key={item.slug}
                onClick={() => onSelect('category', item.slug)}
              >
                {item.name[locale]}
              </button>
            ))}
          </div>
          {category ? (
            <div className="map-subs">
              {category.subs.map((item) => (
                <button
                  type="button"
                  className={`map-sub ${item.slug === state.subcategory ? 'is-active' : ''}`}
                  key={item.slug}
                  onClick={() => onSelect('subcategory', item.slug)}
                >
                  {item.name[locale]}
                </button>
              ))}
            </div>
          ) : (
            <div className="map-subs"><span className="map-empty">{s.selectCategory}</span></div>
          )}
        </>
      ) : (
        <div className="map-cats"><span className="map-empty">{s.selectBrand}</span></div>
      )}
    </section>
  );
}
