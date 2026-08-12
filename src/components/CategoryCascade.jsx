import { useEffect, useMemo, useRef, useState } from 'react';
import { getBrand, getCategory, getManufacturersForPath, getSubcategory, velvetBrands } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';

function CascadeSelect({ hint, placeholder, value, disabled, options, allLabel, onSelect, locale }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selected = options.find((option) => option.id === value);

  return (
    <div className={`cascade-dd ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="cascade-dd__button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="cascade-dd__label">
          <span className="cascade-dd__hint">{hint}</span>
          <span className="cascade-dd__value">{selected ? selected.label : placeholder}</span>
        </span>
        <span className="cascade-dd__chevron" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="cascade-dd__menu" role="listbox">
          <button type="button" role="option" aria-selected={!value} className={!value ? 'is-active' : ''} onClick={() => { onSelect(''); setOpen(false); }}>
            <span>{allLabel}</span>
          </button>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={value === option.id}
              className={value === option.id ? 'is-active' : ''}
              key={option.id}
              onClick={() => { onSelect(option.id); setOpen(false); }}
            >
              <span className="cascade-dd__option-label">{option.label}</span>
              {option.count != null && <small className="cascade-dd__count">{option.count}</small>}
              {option.sub && <span className="cascade-dd__sub">{option.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoryCascade({ state, onSelect, hideBrand = false }) {
  const { copy, locale } = useI18n();
  const s = copy.shop;

  const brandOptions = useMemo(() => velvetBrands.map((brand) => ({
    id: brand.slug,
    label: brand.name[locale],
    sub: brand.tagline[locale],
  })), [locale]);

  const brand = getBrand(state.brand);
  const category = brand && state.category ? getCategory(brand.slug, state.category) : null;
  const sub = category && state.subcategory ? getSubcategory(brand.slug, category.slug, state.subcategory) : null;

  const categoryOptions = useMemo(() => (
    brand ? brand.categories.map((item) => ({ id: item.slug, label: item.name[locale], count: item.subs.length })) : []
  ), [brand, locale]);

  const subOptions = useMemo(() => (
    category ? category.subs.map((item) => ({ id: item.slug, label: item.name[locale] })) : []
  ), [category, locale]);

  const manufacturers = useMemo(() => (
    state.brand ? getManufacturersForPath(state) : []
  ), [state]);

  const manufacturerOptions = manufacturers.map((item) => ({ id: item.id, label: item.name, count: item.count }));

  return (
    <div className="cascade-row" role="group" aria-label={s.browseBy}>
      {!hideBrand && (
        <CascadeSelect
          hint={s.brand}
          placeholder={s.selectBrand}
          value={state.brand}
          disabled={false}
          options={brandOptions}
          allLabel={s.allBrands}
          locale={locale}
          onSelect={(value) => onSelect('brand', value)}
        />
      )}
      <CascadeSelect
        hint={s.category}
        placeholder={brand ? s.selectCategory : s.selectBrandFirst}
        value={state.category}
        disabled={!brand}
        options={categoryOptions}
        allLabel={s.allCategories}
        locale={locale}
        onSelect={(value) => onSelect('category', value)}
      />
      <CascadeSelect
        hint={s.subcategory}
        placeholder={category ? s.selectSubcategory : s.selectCategoryFirst}
        value={state.subcategory}
        disabled={!category}
        options={subOptions}
        allLabel={s.allSubcategories}
        locale={locale}
        onSelect={(value) => onSelect('subcategory', value)}
      />
      <CascadeSelect
        hint={s.manufacturer}
        placeholder={sub ? s.selectManufacturer : s.selectSubcategoryFirst}
        value={state.manufacturer}
        disabled={!sub || manufacturers.length === 0}
        options={manufacturerOptions}
        allLabel={s.allManufacturers}
        locale={locale}
        onSelect={(value) => onSelect('manufacturer', value)}
      />
    </div>
  );
}
