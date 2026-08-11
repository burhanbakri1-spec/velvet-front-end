import { useMemo } from 'react';
import FilterGroup from './FilterGroup';
import { filterGroups, getFilterCounts } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';

export default function ProductFilters({ state, onToggle, onClear }) {
  const { copy, locale } = useI18n();
  const s = copy.shop;
  const counts = useMemo(() => getFilterCounts(state), [state]);

  const withLabels = (key) => filterGroups[key].map((item) => ({
    id: item.id,
    label: item.name[locale],
    count: counts[key][item.id] || 0,
  }));

  const activeCount = state.age.length + state.gender.length + state.skill.length + state.occasion.length + state.shopping.length;

  return (
    <div className="product-filters">
      <div className="product-filters__head">
        <h2>{s.shopBy}</h2>
        {activeCount > 0 && (
          <button type="button" className="product-filters__clear" onClick={onClear}>{s.clearAll}</button>
        )}
      </div>
      <FilterGroup title={s.age} options={withLabels('age')} selected={state.age} onToggle={(id) => onToggle('age', id)} />
      <FilterGroup title={s.gender} options={withLabels('gender')} selected={state.gender} onToggle={(id) => onToggle('gender', id)} />
      <FilterGroup title={s.skill} options={withLabels('skill')} selected={state.skill} onToggle={(id) => onToggle('skill', id)} />
      <FilterGroup title={s.occasion} options={withLabels('occasion')} selected={state.occasion} onToggle={(id) => onToggle('occasion', id)} />
      <FilterGroup title={s.quickShop} options={withLabels('shopping')} selected={state.shopping} onToggle={(id) => onToggle('shopping', id)} variant="chip" />
    </div>
  );
}
