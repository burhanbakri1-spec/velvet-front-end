import { useState } from 'react';

export default function FilterGroup({ title, options, selected, onToggle, variant = 'check', defaultOpen = selected.length > 0 }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="filter-group" open={open}>
      <summary
        className="filter-group__head"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        <span>{title}</span>
      </summary>
      {variant === 'chip' ? (
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
      )}
    </details>
  );
}
