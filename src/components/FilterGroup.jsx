import { useState } from 'react';

export default function FilterGroup({ title, options, selected, onToggle, variant = 'check', defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="filter-group">
      <button type="button" className="filter-group__head" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{title}</span>
        <i className="filter-group__chevron" aria-hidden="true" />
      </button>
      {open && (
        variant === 'chip' ? (
          <div className="filter-group__chips">
            {options.map((option) => (
              <button
                type="button"
                className={`filter-chip ${selected.includes(option.id) ? 'is-active' : ''}`}
                aria-pressed={selected.includes(option.id)}
                key={option.id}
                onClick={() => onToggle(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="filter-group__opts">
            {options.map((option) => (
              <label className={`filter-option ${selected.includes(option.id) ? 'is-active' : ''}`} key={option.id}>
                <input type="checkbox" checked={selected.includes(option.id)} onChange={() => onToggle(option.id)} />
                <span className="filter-option__box" aria-hidden="true" />
                <span className="filter-option__label">{option.label}</span>
                {option.count != null && <small className="filter-option__count">{option.count}</small>}
              </label>
            ))}
          </div>
        )
      )}
    </div>
  );
}
