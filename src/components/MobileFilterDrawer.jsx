import { useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';

export default function MobileFilterDrawer({ open, onClose, onClear, children }) {
  const { copy } = useI18n();
  const s = copy.shop;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`shop-drawer-overlay ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`shop-drawer ${open ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label={s.filters}>
        <div className="shop-drawer__head">
          <strong>{s.filters}</strong>
          <button type="button" className="shop-drawer__close" aria-label={s.close} onClick={onClose}>×</button>
        </div>
        <div className="shop-drawer__body">{children}</div>
        <div className="shop-drawer__foot">
          <button type="button" className="shop-drawer__clear" onClick={onClear}>{s.clearAll}</button>
          <button type="button" className="store-primary-button shop-drawer__apply" onClick={onClose}>{s.apply}</button>
        </div>
      </aside>
    </>
  );
}
