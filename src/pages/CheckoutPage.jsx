import { useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { velvetProducts } from '../data/velvetCatalog';
import { formatPrice } from '../data/currency';
import { buildWhatsAppOrderMessage, buildWhatsAppOrderUrl, openWhatsAppOrder } from '../data/whatsappOrder';
import { buildOrderPayload, createOrder, persistOrderSnapshot } from '../data/orders';
import { isStorefrontApiConfigured } from '../data/apiClient';
import { Link } from '../routing/Router';
import { useI18n } from '../i18n/I18nContext';

export default function CheckoutPage() {
  const { items, subtotal, addItem } = useCart();
  const { copy, locale } = useI18n();
  const { token, customer } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', address: '', notes: '' });
  const [prepared, setPrepared] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);

  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const inCartSlugs = useMemo(() => new Set(items.map((item) => item.slug)), [items]);
  const recommended = useMemo(() => velvetProducts.filter((item) => !inCartSlugs.has(item.slug)).slice(0, 4), [inCartSlugs]);

  const handlePlaceOrder = async (event) => {
    event.preventDefault();
    setError(null);
    setPlacing(true);
    try {
      let order = null;
      // Real order first when the storefront API is configured. Guest checkout
      // is allowed (no token); logged-in customers attach their Bearer token so
      // the server associates the order with their account.
      if (isStorefrontApiConfigured()) {
        const payload = buildOrderPayload({ customer: form, items });
        const result = await createOrder(payload, { token });
        if (!result.ok) {
          setError(result.message || copy.checkout.orderError);
          setPlacing(false);
          return;
        }
        order = result.order;
        if (customer) persistOrderSnapshot(order, customer);
      }

      const message = buildWhatsAppOrderMessage({
        customer: form,
        items,
        subtotal,
        shippingLabel: 'مجاني',
        orderNumber: order?.orderNumber || order?.id || '',
        status: order?.status || '',
      });
      const url = buildWhatsAppOrderUrl(message);
      const opened = openWhatsAppOrder(url);
      // Keep cart intact — WhatsApp send is customer-driven; the order is
      // already recorded server-side when the API is configured.
      setPrepared({ message, url, opened, order });
    } catch {
      setError(copy.checkout.orderError);
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0 && !prepared) {
    return (
      <section className="checkout-page">
        <div className="checkout-empty">
          <span className="store-eyebrow">{copy.checkout.eyebrow}</span>
          <h1>{copy.checkout.emptyTitle}</h1>
          <p>{copy.checkout.emptyBody}</p>
          <Link className="store-primary-button" to="/products">{copy.checkout.browse}</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-shell">
        <nav className="checkout-breadcrumb" aria-label={copy.checkout.backToCart}>
          <Link to="/cart">{locale === 'ar' ? '→' : '←'} {copy.checkout.backToCart}</Link>
          <span>{locale === 'ar' ? '←' : '→'}</span>
          <span>{copy.checkout.title}</span>
        </nav>

        {prepared ? (
          <section className="checkout-placed">
            <div className="checkout-placed__icon" aria-hidden="true">✓</div>
            <h2>{copy.checkout.successTitle}</h2>
            {prepared.order?.orderNumber ? (
              <p className="checkout-placed__order">
                {copy.checkout.orderNumber}: <strong>{prepared.order.orderNumber}</strong>
                {' · '}
                {copy.checkout.orderStatus}: <strong>{prepared.order.status || 'Pending'}</strong>
              </p>
            ) : null}
            <p>{copy.checkout.successBody}</p>
            {!prepared.opened && (
              <p className="checkout-panel__note">{copy.checkout.whatsappFallbackHint}</p>
            )}
            <a
              className="store-primary-button"
              href={prepared.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy.checkout.whatsappSend}
            </a>
            <Link className="store-secondary-button" to="/products">{copy.checkout.browse}</Link>
          </section>
        ) : (
          <form className="checkout-main" onSubmit={handlePlaceOrder}>
            <section className="checkout-summary-panel" aria-label={copy.checkout.orderTitle}>
              <div className="checkout-summary-panel__head">
                <span className="store-eyebrow">{copy.checkout.orderTitle}</span>
                <h2>{copy.checkout.items} {items.length > 0 && <sup>{items.length}</sup>}</h2>
              </div>
              <ul className="checkout-gallery">
                {items.map((item, index) => {
                  const variants = Object.keys(item.selections || {}).length > 0 ? Object.values(item.selections).join(' · ') : '';
                  return (
                    <li className={`checkout-gallery__item ${index === 0 ? 'checkout-gallery__item--lead' : ''}`} key={item.key}>
                      <Link className="checkout-gallery__link" to={`/products/${item.slug}`} aria-label={`${copy.products.view} ${item.name}`}><img src={item.image} alt={item.name} /></Link>
                      <div className="checkout-gallery__caption">
                        <Link to={`/products/${item.slug}`}><h3>{item.name}</h3></Link>
                        {variants && <p className="checkout-gallery__variants">{variants}</p>}
                        <span className="checkout-gallery__meta">{item.quantity} × {formatPrice(item.price)}</span>
                      </div>
                      <strong className="checkout-gallery__total">{formatPrice(item.price * item.quantity)}</strong>
                    </li>
                  );
                })}
              </ul>
              <dl className="checkout-summary">
                <div><dt>{copy.checkout.subtotal}</dt><dd>{formatPrice(subtotal)}</dd></div>
                <div><dt>{copy.checkout.shipping}</dt><dd>{copy.checkout.free}</dd></div>
                <div className="checkout-summary__grand"><dt>{copy.checkout.total}</dt><dd>{formatPrice(subtotal)}</dd></div>
              </dl>
            </section>

            <aside className="checkout-panel">
              <div className="checkout-panel__top">
                <span className="product-detail-category">{copy.checkout.customerTitle}</span>
                <span className="checkout-panel__count">{items.length} {copy.checkout.items}</span>
              </div>
              <h1>{copy.checkout.title}</h1>

              <div className="checkout-panel__fields">
                <div className="checkout-field">
                  <label htmlFor="checkout-name">{copy.checkout.fullName}</label>
                  <input id="checkout-name" required value={form.name} onChange={setField('name')} placeholder={copy.checkout.fullNamePlaceholder} name="name" autoComplete="name" />
                </div>
                <div className="checkout-field-row">
                  <div className="checkout-field">
                    <label htmlFor="checkout-phone">{copy.checkout.phone}</label>
                    <input id="checkout-phone" required value={form.phone} onChange={setField('phone')} placeholder={copy.checkout.phonePlaceholder} name="phone" type="tel" autoComplete="tel" />
                  </div>
                  <div className="checkout-field">
                    <label htmlFor="checkout-email">{copy.checkout.email}</label>
                    <input id="checkout-email" required value={form.email} onChange={setField('email')} placeholder={copy.checkout.emailPlaceholder} name="email" type="email" autoComplete="email" />
                  </div>
                </div>
                <div className="checkout-field">
                  <label htmlFor="checkout-city">{copy.checkout.city}</label>
                  <input id="checkout-city" required value={form.city} onChange={setField('city')} placeholder={copy.checkout.cityPlaceholder} name="city" autoComplete="address-level2" />
                </div>
                <div className="checkout-field">
                  <label htmlFor="checkout-address">{copy.checkout.address}</label>
                  <input id="checkout-address" required value={form.address} onChange={setField('address')} placeholder={copy.checkout.addressPlaceholder} name="address" autoComplete="street-address" />
                </div>
                <div className="checkout-field">
                  <label htmlFor="checkout-notes">{copy.checkout.notes}</label>
                  <textarea id="checkout-notes" value={form.notes} onChange={setField('notes')} placeholder={copy.checkout.notesPlaceholder} name="notes" rows={3} />
                </div>
              </div>

              {error ? (
                <p className="auth-panel__status auth-panel__status--error" role="status">{error}</p>
              ) : null}

              <button className="store-primary-button checkout-panel__cta" type="submit" disabled={placing}>
                {placing ? copy.checkout.placing : copy.checkout.placeOrder}
              </button>
              <p className="checkout-panel__note">{copy.checkout.note}</p>
            </aside>
          </form>
        )}

        <section className="checkout-related">
          <div className="checkout-related__head"><span className="store-eyebrow">{copy.checkout.keep}</span><h2>{copy.checkout.related}</h2></div>
          <div className="checkout-related__track">
            {recommended.map((item) => (
              <ProductCard product={item} key={item.id} onAddToCart={(product) => addItem(product)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}