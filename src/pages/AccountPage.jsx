import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Link, localizePath, useRouter } from '../routing/Router';
import { createAddress, deleteAddress, fetchAddresses } from '../data/customerAuth';
import { getFavorites } from '../data/favorites';
import { fetchMyOrders } from '../data/orders';
import {
  getOptimisticPendingReviews,
  listApprovedReviewsForCustomer,
} from '../data/reviews';
import { formatPrice } from '../data/currency';

const TABS = ['profile', 'addresses', 'orders', 'favorites', 'reviews'];

function ProfileTab({ customer, onLogout }) {
  const { copy, locale } = useI18n();
  const { updateProfile } = useAuth();
  const [form, setForm] = useState({ name: customer?.name || '', phone: customer?.phone || '' });
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(false);

  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    setPending(true);
    try {
      const result = await updateProfile({ name: form.name, phone: form.phone });
      setStatus(result.ok
        ? { tone: 'info', message: copy.account.profileSaved }
        : { tone: 'error', message: result.message || copy.account.profileError });
    } catch {
      setStatus({ tone: 'error', message: copy.account.profileError });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="account-tab">
      <dl className="account-profile">
        <div><dt>{copy.register.email}</dt><dd dir="ltr">{customer?.email || '—'}</dd></div>
        <div><dt>{copy.register.name}</dt><dd>{customer?.name || '—'}</dd></div>
        <div><dt>{copy.register.phone}</dt><dd dir="ltr">{customer?.phone || '—'}</dd></div>
      </dl>

      <form className="auth-form account-profile-form" onSubmit={handleSubmit}>
        <label>
          <span>{copy.register.name}</span>
          <input name="name" type="text" value={form.name} onChange={setField('name')} placeholder={copy.register.namePlaceholder} />
        </label>
        <label>
          <span>{copy.register.phone}</span>
          <input name="phone" type="tel" dir="ltr" value={form.phone} onChange={setField('phone')} placeholder={copy.register.phonePlaceholder} />
        </label>
        <div className="auth-form__actions">
          <button className="store-primary-button" type="submit" disabled={pending}>
            {pending ? copy.account.saving : copy.account.saveProfile}
            <i>{locale === 'ar' ? '←' : '→'}</i>
          </button>
          <button className="store-secondary-button account-signout" type="button" onClick={onLogout}>
            {copy.account.signOut}
          </button>
        </div>
      </form>

      {status ? (
        <p className={`auth-panel__status auth-panel__status--${status.tone}`} role="status">{status.message}</p>
      ) : null}
    </div>
  );
}

function AddressesTab() {
  const { copy, locale } = useI18n();
  const { token } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState({ label: '', fullName: '', phone: '', city: '', address: '', notes: '' });
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(false);

  const load = async () => {
    const result = await fetchAddresses(token);
    if (result.ok) setAddresses(result.addresses);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleCreate = async (event) => {
    event.preventDefault();
    setStatus(null);
    setPending(true);
    try {
      const result = await createAddress(form, token);
      if (result.ok) {
        setForm({ label: '', fullName: '', phone: '', city: '', address: '', notes: '' });
        setStatus({ tone: 'info', message: copy.account.addressSaved });
        load();
      } else {
        setStatus({ tone: 'error', message: result.message || copy.account.addressError });
      }
    } catch {
      setStatus({ tone: 'error', message: copy.account.addressError });
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (addressId) => {
    const result = await deleteAddress(addressId, token);
    if (result.ok) load();
  };

  return (
    <div className="account-tab">
      {addresses.length > 0 ? (
        <ul className="account-addresses">
          {addresses.map((address) => (
            <li className="account-address" key={address.id || address.label}>
              <strong>{address.label || address.fullName}</strong>
              <span>{address.fullName} · {address.phone}</span>
              <span>{address.city} — {address.address}</span>
              {address.notes ? <span>{address.notes}</span> : null}
              <button type="button" className="account-address__delete" onClick={() => handleDelete(address.id)}>
                {copy.account.addressDelete}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="auth-panel__note">{copy.account.addressesEmpty}</p>
      )}

      <form className="auth-form account-address-form" onSubmit={handleCreate}>
        <label>
          <span>{copy.account.addressLabel}</span>
          <input name="label" value={form.label} onChange={setField('label')} placeholder={copy.account.addressLabelPlaceholder} />
        </label>
        <label>
          <span>{copy.account.addressFullName}</span>
          <input name="fullName" required value={form.fullName} onChange={setField('fullName')} placeholder={copy.account.addressFullNamePlaceholder} />
        </label>
        <label>
          <span>{copy.account.addressPhone}</span>
          <input name="phone" type="tel" dir="ltr" required value={form.phone} onChange={setField('phone')} placeholder={copy.account.addressPhonePlaceholder} />
        </label>
        <label>
          <span>{copy.account.addressCity}</span>
          <input name="city" required value={form.city} onChange={setField('city')} placeholder={copy.account.addressCityPlaceholder} />
        </label>
        <label>
          <span>{copy.account.addressAddress}</span>
          <input name="address" required value={form.address} onChange={setField('address')} placeholder={copy.account.addressAddressPlaceholder} />
        </label>
        <label>
          <span>{copy.account.addressNotes}</span>
          <input name="notes" value={form.notes} onChange={setField('notes')} placeholder={copy.account.addressNotesPlaceholder} />
        </label>
        <div className="auth-form__actions">
          <button className="store-primary-button" type="submit" disabled={pending}>
            {pending ? copy.account.saving : copy.account.addressAdd}
            <i>{locale === 'ar' ? '←' : '→'}</i>
          </button>
        </div>
      </form>

      {status ? (
        <p className={`auth-panel__status auth-panel__status--${status.tone}`} role="status">{status.message}</p>
      ) : null}
    </div>
  );
}

function OrdersTab() {
  const { copy, locale } = useI18n();
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Source of truth: GET /api/orders/my-orders — never local snapshots.
    fetchMyOrders(token).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setOrders(Array.isArray(result.orders) ? result.orders : []);
        setError(null);
      } else {
        setOrders([]);
        setError(result.message || copy.account.ordersError);
      }
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
      setOrders([]);
      setError(copy.account.ordersError);
    });
    return () => { cancelled = true; };
  }, [token, copy.account.ordersError]);

  if (loading) {
    return (
      <div className="account-tab">
        <p className="auth-panel__note" role="status">{copy.account.ordersLoading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="account-tab">
        <p className="auth-panel__status auth-panel__status--error" role="alert">{error}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="account-tab">
        <p className="auth-panel__note">{copy.account.ordersEmpty}</p>
        <p className="auth-panel__footer"><Link to="/products">{copy.account.ordersBrowse}</Link></p>
      </div>
    );
  }

  return (
    <div className="account-tab">
      <ul className="account-orders">
        {orders.map((order) => (
          <li className="account-order" key={order.id || order.orderNumber}>
            <strong>{order.orderNumber || order.id}</strong>
            <span>{copy.account.orderStatus}: {order.status || 'Pending'}</span>
            <span>{copy.account.orderDate}: {new Date(order.createdAt || Date.now()).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-GB')}</span>
            {order.total != null ? <span>{copy.account.orderTotal}: {formatPrice(order.total)}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FavoritesTab() {
  const { copy, locale } = useI18n();
  const { token } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getFavorites(token).then((result) => {
      if (cancelled) return;
      if (result.ok) setFavorites(result.products || []);
      else setStatus({ tone: 'error', message: result.message || copy.account.favoritesError });
    }).catch(() => {
      if (!cancelled) setStatus({ tone: 'error', message: copy.account.favoritesError });
    });
    return () => { cancelled = true; };
  }, [token, copy.account.favoritesError]);

  if (favorites.length === 0) {
    return (
      <div className="account-tab">
        <p className="auth-panel__note">{copy.account.favoritesEmpty}</p>
        <p className="auth-panel__footer"><Link to="/products">{copy.account.favoritesBrowse}</Link></p>
      </div>
    );
  }

  return (
    <div className="account-tab">
      {status ? <p className={`auth-panel__status auth-panel__status--${status.tone}`} role="status">{status.message}</p> : null}
      <ul className="account-favorites">
        {favorites.map((product) => (
          <li className="account-favorite" key={product.id || product.slug}>
            {product.image ? <img src={product.image} alt="" /> : null}
            <Link to={`/products/${product.slug || product.id}`}>
              {product.name?.[locale] || product.name || product.nameAr || product.id}
            </Link>
            {product.price != null ? <span>{formatPrice(product.price)}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewsTab() {
  const { copy } = useI18n();
  const { token, customer } = useAuth();
  // No GET customer my-reviews API — approved attribution from public list + local optimistic pending only.
  const [approved, setApproved] = useState([]);
  const [pendingOptimistic, setPendingOptimistic] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPendingOptimistic(getOptimisticPendingReviews(customer));
    listApprovedReviewsForCustomer(customer, { token }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setApproved(result.reviews);
        setStatus(null);
      } else {
        setApproved([]);
        setStatus({ tone: 'error', message: result.message || copy.account.reviewsError });
      }
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
      setApproved([]);
      setStatus({ tone: 'error', message: copy.account.reviewsError });
    });
    return () => { cancelled = true; };
  }, [token, customer, copy.account.reviewsError]);

  if (loading) {
    return (
      <div className="account-tab">
        <p className="auth-panel__note" role="status">{copy.account.reviewsLoading}</p>
      </div>
    );
  }

  const hasAnything = approved.length > 0 || pendingOptimistic.length > 0;
  if (!hasAnything) {
    return (
      <div className="account-tab">
        {status ? <p className={`auth-panel__status auth-panel__status--${status.tone}`} role="status">{status.message}</p> : null}
        <p className="auth-panel__note">{copy.account.reviewsEmpty}</p>
        <p className="auth-panel__footer"><Link to="/products">{copy.account.reviewsBrowse}</Link></p>
      </div>
    );
  }

  return (
    <div className="account-tab">
      {status ? <p className={`auth-panel__status auth-panel__status--${status.tone}`} role="status">{status.message}</p> : null}
      {pendingOptimistic.length > 0 ? (
        <p className="auth-panel__note" role="note">{copy.account.reviewsPendingNote}</p>
      ) : null}
      <ul className="account-reviews">
        {pendingOptimistic.map((review, index) => (
          <li className="account-review account-review--pending" key={review.id || `pending-${index}`}>
            <strong>{'★'.repeat(Math.max(1, Math.min(5, Number(review.rating) || 5)))}</strong>
            <span>{review.comment}</span>
            <small>{copy.account.reviewPendingBadge} · {review.scope === 'product' ? `${copy.account.reviewProduct}: ${review.productId || ''}` : copy.account.reviewStore}</small>
          </li>
        ))}
        {approved.map((review, index) => (
          <li className="account-review" key={review.id || `approved-${index}`}>
            <strong>{'★'.repeat(Math.max(1, Math.min(5, Number(review.rating) || 5)))}</strong>
            <span>{review.comment}</span>
            <small>{copy.account.reviewApprovedBadge} · {review.scope === 'product' ? `${copy.account.reviewProduct}: ${review.productId || ''}` : copy.account.reviewStore}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AccountPage() {
  const { copy, locale } = useI18n();
  const { isAuthenticated, customer, logout, authConfigured } = useAuth();
  const { navigate } = useRouter();
  const [tab, setTab] = useState('profile');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(localizePath('/login', locale));
    }
  }, [isAuthenticated, locale, navigate]);

  if (!isAuthenticated) {
    return (
      <div className="auth-page">
        <section className="auth-panel" aria-labelledby="account-title">
          <span className="store-eyebrow">{copy.account.eyebrow}</span>
          <h1 id="account-title">{copy.account.title}</h1>
          <p className="auth-panel__intro">{copy.account.redirecting}</p>
          <p className="auth-panel__footer">
            <Link to="/login">{copy.account.signIn}</Link>
          </p>
        </section>
      </div>
    );
  }

  const displayName = customer?.name || customer?.email || copy.account.member;

  const handleLogout = () => {
    logout();
    navigate(localizePath('/login', locale));
  };

  return (
    <div className="auth-page">
      <section className="auth-panel auth-panel--account" aria-labelledby="account-title">
        <span className="store-eyebrow">{copy.account.eyebrow}</span>
        <h1 id="account-title">{copy.account.title}</h1>
        <p className="auth-panel__intro">
          {copy.account.welcome.replace('{name}', displayName)}
        </p>
        {!authConfigured ? (
          <p className="auth-panel__note">{copy.login.unavailableNote}</p>
        ) : null}

        <nav className="account-tabs" aria-label={copy.account.tabsLabel}>
          {TABS.map((key) => (
            <button
              type="button"
              key={key}
              className={`account-tabs__tab${tab === key ? ' is-active' : ''}`}
              onClick={() => setTab(key)}
            >
              {copy.account[`tab_${key}`]}
            </button>
          ))}
        </nav>

        {tab === 'profile' && <ProfileTab customer={customer} onLogout={handleLogout} />}
        {tab === 'addresses' && <AddressesTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'favorites' && <FavoritesTab />}
        {tab === 'reviews' && <ReviewsTab />}

        <p className="auth-panel__footer">
          <Link to="/">{copy.login.backHome}</Link>
        </p>
      </section>
    </div>
  );
}