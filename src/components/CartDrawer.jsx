import { useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { getOptionName, getOptionValue } from '../data/products';
import { getProductBySlug } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

// Slide-in cart drawer from the physical right edge. Reuses CartContext
// (items, quantity, remove, subtotal) shared with CartPage/ProductDetailsPage;
// the CartPage route stays untouched and available.
export default function CartDrawer({ open, onClose }) {
  const { items, itemCount, subtotal, updateQuantity, removeItem } = useCart();
  const { copy, locale } = useI18n();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => event.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = (item, defaultValue) => (locale === 'ar' ? item.nameAr : item.name) || defaultValue;

  return (
    <div className={`cart-drawer ${open ? 'is-open' : ''}`} role="dialog" aria-modal={open} aria-hidden={!open} aria-label={copy.cart.title}>
      <button className="cart-drawer__overlay" type="button" aria-label={copy.header.menu} onClick={onClose} />
      <aside className="cart-drawer__panel">
        <header className="cart-drawer__head">
          <h2>{copy.cart.title} {itemCount > 0 && <sup>{itemCount}</sup>}</h2>
          <button className="cart-drawer__close" type="button" aria-label={copy.header.menu} onClick={onClose}>×</button>
        </header>

        {items.length === 0 ? (
          <div className="cart-drawer__empty">
            <p>{copy.cart.emptyBody}</p>
            <Link className="store-primary-button cart-drawer__browse" to="/products" onClick={onClose}>{copy.cart.browse}</Link>
          </div>
        ) : (
          <>
            <ul className="cart-drawer__items">
              {items.map((item) => {
                const product = getProductBySlug(item.slug);
                return (
                  <li className="cart-drawer__item" key={item.key}>
                    <Link className="cart-drawer__image" to={`/products/${item.slug}`} onClick={onClose}>
                      <img src={item.image} alt={name(item, item.name)} />
                    </Link>
                    <div className="cart-drawer__info">
                      <Link className="cart-drawer__name" to={`/products/${item.slug}`} onClick={onClose}>{name(item, item.name)}</Link>
                      {Object.keys(item.selections).length > 0 && (
                        <div className="cart-drawer__variants">
                          {Object.entries(item.selections).map(([optionName, value]) => {
                            const option = product?.options.find((entry) => entry.name === optionName);
                            const optionValue = option?.values.find((entry) => entry.label === value);
                            return <span key={optionName}>{option ? getOptionName(option, locale) : optionName}: {optionValue ? getOptionValue(optionValue, locale) : value}</span>;
                          })}
                        </div>
                      )}
                      <div className="cart-drawer__price">{formatPrice(item.price)} <span className="cart-drawer__each">{copy.cart.each}</span></div>
                      <div className="cart-drawer__controls">
                        <div className="quantity-control quantity-control--cart" aria-label={`${copy.cart.quantityFor} ${name(item)}`}>
                          <button type="button" aria-label={`${copy.cart.decrease} ${name(item)}`} onClick={() => updateQuantity(item.key, item.quantity - 1)}>−</button>
                          <span>{item.quantity}</span>
                          <button type="button" disabled={item.maxStock != null && item.quantity >= item.maxStock} aria-label={`${copy.cart.increase} ${name(item)}`} onClick={() => updateQuantity(item.key, item.quantity + 1)}>+</button>
                        </div>
                        <strong className="cart-drawer__line-total">{formatPrice(item.price * item.quantity)}</strong>
                        <button className="cart-drawer__remove" type="button" aria-label={`${copy.cart.remove} ${name(item)}`} onClick={() => removeItem(item.key)}>{copy.cart.remove}</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <footer className="cart-drawer__footer">
              <dl className="cart-drawer__summary">
                <div><dt>{copy.cart.subtotal}</dt><dd>{formatPrice(subtotal)}</dd></div>
                <div><dt>{copy.cart.shipping}</dt><dd>{copy.cart.free}</dd></div>
                <div className="cart-drawer__total"><dt>{copy.cart.total}</dt><dd>{formatPrice(subtotal)}</dd></div>
              </dl>
              <Link className="store-primary-button cart-drawer__checkout" to="/checkout" onClick={onClose}>{copy.cart.checkout}</Link>
              <Link className="cart-drawer__secondary" to="/cart" onClick={onClose}>{copy.cart.title}</Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
