import { useMemo, useState } from 'react';
import { getActiveFilterTags } from '../data/velvetCatalog';
import { getAttributeFacetOptions, getFacetHierarchyOptions } from '../data/shopFacets';
import { useI18n } from '../i18n/I18nContext';

const HIERARCHY_COLUMNS = [
  { key: 'brand', optionsKey: 'brands', labelKey: 'brand' },
  { key: 'category', optionsKey: 'categories', labelKey: 'mainCategory' },
  { key: 'subcategory', optionsKey: 'subcategories', labelKey: 'subcategory' },
];

const FILTER_COLUMNS = [
  { key: 'age', group: 'age', labelKey: 'age', variant: 'check' },
  { key: 'gender', group: 'gender', labelKey: 'gender', variant: 'check' },
  { key: 'skill', group: 'skill', labelKey: 'skill', variant: 'check' },
  { key: 'occasion', group: 'occasion', labelKey: 'occasion', variant: 'check' },
  { key: 'shopping', group: 'shopping', labelKey: 'quickShop', variant: 'chip' },
];

function FilterColumn({ column, selected, options, emptyHint, onReset, onToggle, resetLabel }) {
  const hasSelection = selected.length > 0;
  if (!options.length && !emptyHint && !hasSelection) return null;

  return (
    <div
      className={`shop-filter-column${hasSelection ? ' shop-filter-column--has-selection' : ''}`}
      data-filter-group={column.key}
      data-has-selection={hasSelection || undefined}
    >
      <div className="shop-filter-column__head">
        <h3>
          {column.label}
          {hasSelection && <span className="shop-filter-column__count"> ({selected.length})</span>}
        </h3>
        {hasSelection && (
          <button type="button" className="shop-filter-column__reset" onClick={onReset}>{resetLabel}</button>
        )}
      </div>
      {options.length === 0 && emptyHint ? (
        <p className="shop-filter-column__hint">{emptyHint}</p>
      ) : column.variant === 'chip' ? (
        <div className="filter-group__chips">
          {options.map((option) => {
            const active = selected.includes(option.id);
            return (
              <button
                type="button"
                className={`filter-chip${active ? ' is-active' : ''}${hasSelection && !active ? ' is-inactive' : ''}`}
                aria-pressed={active}
                key={option.id}
                onClick={() => onToggle(option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="filter-group__opts">
          {options.map((option) => {
            const active = selected.includes(option.id);
            return (
              <label
                className={`filter-option${active ? ' is-active' : ''}${hasSelection && !active ? ' is-inactive' : ''}`}
                key={option.id}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onToggle(option.id)}
                />
                <span className="filter-option__box" aria-hidden="true" />
                <span className="filter-option__label">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GridDensityControl({ gridCols, onGridColsChange, labels }) {
  const choices = [2, 3, 4];
  return (
    <div className="shop-grid-density" data-shop-grid-density aria-label={labels.view}>
      <span className="shop-grid-density__label">{labels.view}</span>
      <div className="shop-grid-density__choices">
        {choices.map((cols) => (
          <button
            type="button"
            key={cols}
            className={`shop-grid-density__btn${gridCols === cols ? ' is-active' : ''}`}
            aria-pressed={gridCols === cols}
            aria-label={labels[`cols${cols}`]}
            onClick={() => onGridColsChange(cols)}
          >
            <span className="shop-grid-density__icon" aria-hidden="true" data-cols={cols} />
            <span className="shop-grid-density__text">{cols}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ShopFilterBar({
  state,
  resultCount,
  onToggle,
  onSelect,
  onRemove,
  onClearGroup,
  onClearAll,
  onSortChange,
  gridCols,
  onGridColsChange,
}) {
  const { copy, locale } = useI18n();
  const s = copy.shop;
  const [open, setOpen] = useState(false);
  const tags = useMemo(() => getActiveFilterTags(state, locale), [state, locale]);
  const hierarchy = useMemo(() => getFacetHierarchyOptions(state), [state]);
  const attributeOptions = useMemo(() => ({
    age: getAttributeFacetOptions(state, 'age', locale),
    gender: getAttributeFacetOptions(state, 'gender', locale),
    skill: getAttributeFacetOptions(state, 'skill', locale),
    occasion: getAttributeFacetOptions(state, 'occasion', locale),
    shopping: getAttributeFacetOptions(state, 'shopping', locale),
  }), [state, locale]);
  const countLabel = resultCount === 1 ? copy.products.countOne : copy.products.count;
  const currentSort = state.sort || 'featured';

  const hierarchyOptions = (key) => (hierarchy[key] || []).map((item) => ({
    id: item.id,
    label: item.name[locale],
  }));

  return (
    <section className={`shop-filter-bar ${open ? 'is-open' : ''}`} data-shop-filter-bar aria-label={s.filters}>
      <div className="shop-filter-bar__row">
        <button
          type="button"
          className="shop-filter-bar__toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <>
              <span className="shop-filter-bar__icon" aria-hidden="true">×</span>
              <span>{s.collapseFilters}</span>
            </>
          ) : (
            <>
              <span className="shop-filter-bar__icon shop-filter-bar__icon--filter" aria-hidden="true" />
              <span>{s.filterBar}</span>
              <span className="shop-filter-bar__count">({resultCount} {countLabel})</span>
            </>
          )}
        </button>

        <div className="shop-filter-bar__chips" aria-label={s.activeFilters}>
          {tags.map((tag) => (
            <span className="tag" key={`${tag.groupKey}:${tag.id}`}>
              {tag.label}
              <button type="button" aria-label={`${s.remove} ${tag.label}`} onClick={() => onRemove(tag.groupKey, tag.id)}>×</button>
            </span>
          ))}
        </div>

        {onGridColsChange && (
          <GridDensityControl
            gridCols={gridCols}
            onGridColsChange={onGridColsChange}
            labels={{
              view: s.gridView,
              cols2: s.gridCols2,
              cols3: s.gridCols3,
              cols4: s.gridCols4,
            }}
          />
        )}

        <label className="shop-filter-bar__sort">
          <span>{s.sort}</span>
          <select
            value={currentSort}
            aria-label={s.sort}
            onChange={(event) => onSortChange(event.target.value)}
          >
            <option value="featured">{s.sortFeatured}</option>
            <option value="newest">{s.sortNewest}</option>
            <option value="price-asc">{s.sortPriceAsc}</option>
            <option value="price-desc">{s.sortPriceDesc}</option>
            <option value="name">{s.sortName}</option>
          </select>
        </label>
      </div>

      {open && (
        <div className="shop-filter-panel" data-shop-filter-panel>
          <div className="shop-filter-panel__groups shop-filter-panel__groups--hierarchy">
            {HIERARCHY_COLUMNS.map((column) => {
              const selected = state[column.key] ? [state[column.key]] : [];
              const options = hierarchyOptions(column.optionsKey);
              const emptyHint = column.key === 'subcategory' && !state.category
                ? s.selectCategoryFirst
                : '';
              return (
                <FilterColumn
                  key={column.key}
                  column={{ ...column, label: s[column.labelKey], variant: 'check' }}
                  selected={selected}
                  options={options}
                  emptyHint={emptyHint}
                  resetLabel={s.reset}
                  onReset={() => onClearGroup(column.key)}
                  onToggle={(id) => onSelect(column.key, selected[0] === id ? '' : id)}
                />
              );
            })}
          </div>
          <div className="shop-filter-panel__groups shop-filter-panel__groups--attrs">
            {FILTER_COLUMNS.map((column) => {
              const selected = state[column.key] || [];
              return (
                <FilterColumn
                  key={column.key}
                  column={{ ...column, label: s[column.labelKey] }}
                  selected={selected}
                  options={attributeOptions[column.group]}
                  resetLabel={s.reset}
                  onReset={() => onClearGroup(column.key)}
                  onToggle={(id) => onToggle(column.key, id)}
                />
              );
            })}
          </div>
          <div className="shop-filter-panel__foot">
            {tags.length > 0 && (
              <button type="button" className="shop-filter-panel__clear" onClick={onClearAll}>{s.clearAll}</button>
            )}
            <button type="button" className="shop-filter-panel__apply" onClick={() => setOpen(false)}>
              {s.applyFilters}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
