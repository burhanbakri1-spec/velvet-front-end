import { filterGroups, getManufacturerName } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';

const GROUP_ORDER = [
  { key: 'age', group: 'age' },
  { key: 'gender', group: 'gender' },
  { key: 'skill', group: 'skill' },
  { key: 'occasion', group: 'occasion' },
  { key: 'shopping', group: 'shopping' },
];

export default function ActiveFilters({ state, onRemove, onClear }) {
  const { copy, locale } = useI18n();
  const s = copy.shop;

  const tags = [];
  GROUP_ORDER.forEach(({ key, group }) => {
    (state[key] || []).forEach((id) => {
      const item = filterGroups[group].find((entry) => entry.id === id);
      tags.push({ groupKey: key, id, label: item ? item.name[locale] : id });
    });
  });
  if (state.manufacturer) {
    tags.push({ groupKey: 'manufacturer', id: state.manufacturer, label: getManufacturerName(state.manufacturer) || state.manufacturer });
  }

  if (tags.length === 0) {
    return <span className="active-filters__placeholder">{s.noActiveFilters}</span>;
  }

  return (
    <div className="active-filters">
      {tags.map((tag) => (
        <span className="tag" key={`${tag.groupKey}:${tag.id}`}>
          {tag.label}
          <button type="button" aria-label={`${s.remove} ${tag.label}`} onClick={() => onRemove(tag.groupKey, tag.id)}>×</button>
        </span>
      ))}
      {tags.length > 0 && (
        <button type="button" className="active-filters__clear" onClick={onClear}>{s.clearAll}</button>
      )}
    </div>
  );
}
