import { useCart } from '../context/CartContext';
import { getOptionName, getOptionValue } from '../data/products';
import { getProductBySlug } from '../data/velvetCatalog';
import { useI18n } from '../i18n/I18nContext';
import { Link } from '../routing/Router';

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

export default function CartPage() {
  const { items, itemCount, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const { copy, locale } = useI18n();

  if (items.length === 0) {
    return (
      <section className="cart-empty">
        <div className="cart-empty__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3.5 4.5h2l1.8 10.1a2 2 0 0 0 2 1.7h7.9a2 2 0 0 0 1.9-1.5l1.2-6.3H6.2" /><circle cx="9.4" cy="19.2" r="1.1" /><circle cx="17.4" cy="19.2" r="1.1" /></svg>
        </div>
        <span className="store-eyebrow">{copy.cart.eyebrow}</span>
        <h1>{copy.cart.emptyTitle}</h1>
        <p>{copy.cart.emptyBody}</p>
        <Link className="store-primary-button" to="/products">{copy.cart.browse}</Link>
      </section>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-page__head">
        <Link className="cart-back-link" to="/products">{locale === 'ar' ? '→' : '←'} {copy.cart.continue}</Link>
        <span className="store-eyebrow">{copy.cart.eyebrow}</span>
        <h1>{copy.cart.title} <sup>{itemCount}</sup></h1>
      </div>

      <div className="cart-layout">
        <section className="cart-items" aria-label={copy.cart.items}>
          {items.map((item) => {
            const product = getProductBySlug(item.slug);
            return (
              <article className="cart-item" key={item.key}>
                <Link className="cart-item__image" to={`/products/${item.slug}`}><img src={item.image} alt={item.name} /></Link>
                <div className="cart-item__info">
                  <div className="cart-item__title-row">
                    <div>
                      <Link to={`/products/${item.slug}`}><h2>{item.name}</h2></Link>
                      {Object.keys(item.selections).length > 0 && (
                        <div className="cart-item__variants">
                          {Object.entries(item.selections).map(([name, value]) => {
                            const option = product?.options.find((entry) => entry.name === name);
                            const optionValue = option?.values.find((entry) => entry.label === value);
                            return <span key={name}>{option ? getOptionName(option, locale) : name}: {optionValue ? getOptionValue(optionValue, locale) : value}</span>;
                          })}
                        </div>
                      )}
                    </div>
                    <strong>{formatPrice(item.price * item.quantity)}</strong>
                  </div>
                  <div className="cart-item__actions">
                    <div className="quantity-control quantity-control--cart" aria-label={`${copy.cart.quantityFor} ${item.name}`}>
                      <button type="button" aria-label={`${copy.cart.decrease} ${item.name}`} onClick={() => updateQuantity(item.key, item.quantity - 1)}>−</button>
                      <span>{item.quantity}</span>
                      <button type="button" disabled={item.maxStock != null && item.quantity >= item.maxStock} aria-label={`${copy.cart.increase} ${item.name}`} onClick={() => updateQuantity(item.key, item.quantity + 1)}>+</button>
                    </div>
                    <span className="cart-item__unit">{formatPrice(item.price)} {copy.cart.each}</span>
                    <button className="cart-remove" type="button" aria-label={`${copy.cart.remove} ${item.name}`} onClick={() => removeItem(item.key)}>{copy.cart.remove}</button>
                  </div>
                </div>
              </article>
            );
          })}
          <button className="cart-clear" type="button" onClick={clearCart}>{copy.cart.clear}</button>
        </section>

        <aside className="cart-summary">
          <span className="store-eyebrow">{copy.cart.summary}</span>
          <h2>{copy.cart.ready}</h2>
          <dl>
            <div><dt>{copy.cart.subtotal}</dt><dd>{formatPrice(subtotal)}</dd></div>
            <div><dt>{copy.cart.shipping}</dt><dd>{copy.cart.free}</dd></div>
            <div className="cart-summary__total"><dt>{copy.cart.total}</dt><dd>{formatPrice(subtotal)}</dd></div>
          </dl>
          <Link className="store-primary-button cart-checkout" to="/checkout">{copy.cart.checkout}</Link>
          <p>{copy.cart.taxes}</p>
        </aside>
      </div>
    </div>
  );
}
