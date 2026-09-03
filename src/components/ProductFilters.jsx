import { useMemo } from 'react';
import FilterGroup from './FilterGroup';
import { getFilterCounts, getFilterGroup } from '../data/velvetCatalog';
import { LIVE_CLASSIFICATION_KEYS } from '../data/classificationFilter';
import { useI18n } from '../i18n/I18nContext';

const LABEL_KEYS = {
  age: 'age',
  gender: 'gender',
  skill: 'skill',
  material: 'material',
  productType: 'productType',
  theme: 'theme',
  collection: 'collectionFilter',
  occasion: 'occasion',
  shopping: 'quickShop',
};

export default function ProductFilters({ state, onToggle, onClear }) {
  const { copy, locale } = useI18n();
  const s = copy.shop;
  const counts = useMemo(() => getFilterCounts(state), [state]);

  const withLabels = (key) => getFilterGroup(key).map((item) => ({
    id: item.id,
    label: item.name[locale],
    count: counts[key]?.[item.id] || 0,
  }));

  const groups = [...LIVE_CLASSIFICATION_KEYS, 'shopping'];
  const activeCount = groups.reduce((sum, key) => sum + (state[key]?.length || 0), 0);

  return (
    <div className="product-filters">
      <div className="product-filters__head">
        <h2>{s.shopBy}</h2>
        {activeCount > 0 && (
          <button type="button" className="product-filters__clear" onClick={onClear}>{s.clearAll}</button>
        )}
      </div>
      {groups.map((key) => {
        const options = withLabels(key);
        if (!options.length && !(state[key]?.length)) return null;
        return (
          <FilterGroup
            key={key}
            title={s[LABEL_KEYS[key]]}
            options={options}
            selected={state[key] || []}
            onToggle={(id) => onToggle(key, id)}
            variant={key === 'shopping' ? 'chip' : undefined}
          />
        );
      })}
    </div>
  );
}
