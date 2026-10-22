import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { getCustomerFacingSelectionLabels, getProductName } from '../data/products';
import { velvetProducts } from '../data/velvetCatalog';
import { formatPrice } from '../data/currency';
import { buildWhatsAppOrderMessage, buildWhatsAppOrderUrl, openWhatsAppOrder } from '../data/whatsappOrder';
import { buildOrderPayload, createOrder, persistOrderSnapshot } from '../data/orders';
import { isStorefrontApiConfigured } from '../data/apiClient';
import {
  computeCheckoutTotals,
  fetchDeliveryZones,
  isDeliveryZoneRejected,
} from '../data/deliveryZones';
import { resolveOrderTotals } from '../data/orderTotals';
import { trackPlatformEvent } from '../analytics/platformAnalytics';
import { Link } from '../routing/Router';
import { useI18n } from '../i18n/I18nContext';
import {
  getPinnedCountries,
  getSearchableCountries,
  COUNTRIES,
  DEFAULT_COUNTRY,
  DEFAULT_COUNTRY_CODE,
  getCallingCode,
  normalizePhone,
  normalizeWhatsApp,
  deriveWhatsAppFromContact,
  getPreferredWhatsAppCanonical,
  createEmptyWhatsAppPayload,
  isValidPhone,
} from '../utils/phoneNormalize';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

/** Searchable country calling code selector component with pinned quick-access countries. */
function CountrySelect({
  id,
  value, // ISO country code (e.g., "PS", "US", "CA")
  onChange, // receives ISO country code
  ariaLabel,
  locale,
  className = 'checkout-country-select',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const optionsRef = useRef([]);

  // Pinned countries always shown at top (Palestine PS, Israel IL)
  const pinnedCountries = useMemo(() => getPinnedCountries(), []);
  // Searchable international list (excludes pinned to avoid duplicates)
  const searchableCountries = useMemo(() => getSearchableCountries(), []);

  // When searching, filter BOTH pinned and searchable countries
  const filteredPinned = useMemo(() => {
    if (!searchQuery.trim()) return pinnedCountries;
    const query = searchQuery.toLowerCase().trim();
    return pinnedCountries.filter(
      (country) =>
        country.code.toLowerCase().includes(query) ||
        country.name.toLowerCase().includes(query) ||
        (country.nameAr && country.nameAr.includes(query)) ||
        country.country.toLowerCase().includes(query)
    );
  }, [searchQuery, pinnedCountries]);

  // Filter searchable countries based on search query
  const filteredSearchable = useMemo(() => {
    if (!searchQuery.trim()) return searchableCountries;
    const query = searchQuery.toLowerCase().trim();
    return searchableCountries.filter(
      (country) =>
        country.code.toLowerCase().includes(query) ||
        country.name.toLowerCase().includes(query) ||
        (country.nameAr && country.nameAr.includes(query)) ||
        country.country.toLowerCase().includes(query)
    );
  }, [searchQuery, searchableCountries]);

  // Combined list: filtered pinned first, then filtered searchable
  const displayCountries = useMemo(
    () => [...filteredPinned, ...filteredSearchable],
    [filteredPinned, filteredSearchable]
  );

  // Get display name based on locale
  const getCountryName = useCallback(
    (country) => (locale === 'ar' && country.nameAr ? country.nameAr : country.name),
    [locale]
  );

  // selectedCountry must come from full COUNTRIES by ISO, NOT from filtered display list
  const selectedCountry = useMemo(
    () => COUNTRIES.find((c) => c.country === value) || COUNTRIES[0],
    [value]
  );

  // Handle keyboard navigation - works for both button and search input
  const handleKeyDown = useCallback(
    (e) => {
      const target = e.target;
      const isSearchInput = target.classList.contains('checkout-country-select-search');

      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      const maxIndex = displayCountries.length - 1;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, maxIndex));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && displayCountries[highlightedIndex]) {
            onChange({ target: { value: displayCountries[highlightedIndex].country } });
            setIsOpen(false);
            setSearchQuery('');
            setHighlightedIndex(-1);
            buttonRef.current?.focus();
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery('');
          setHighlightedIndex(-1);
          buttonRef.current?.focus();
          break;
        case 'Tab':
          setIsOpen(false);
          setSearchQuery('');
          setHighlightedIndex(-1);
          break;
        default:
          // Allow typing in search input
          if (!isSearchInput) {
            e.stopPropagation();
          }
          break;
      }
    },
    [isOpen, displayCountries, highlightedIndex, onChange, locale]
  );

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target) &&
        listRef.current &&
        !listRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Reset highlighted index when display countries change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [displayCountries.length, searchQuery]);

  return (
    <div className={`checkout-country-select-wrapper ${isOpen ? 'is-open' : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        className={`${className} checkout-country-select-button`}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
      >
        <span className="checkout-country-select-code">{selectedCountry.code}</span>
        <span className="checkout-country-select-name">{getCountryName(selectedCountry)}</span>
        <span className="checkout-country-select-arrow" aria-hidden="true">▼</span>
      </button>

      {isOpen && (
        <div
          ref={listRef}
          id={`${id}-listbox`}
          className="checkout-country-select-dropdown"
          role="listbox"
          aria-label={ariaLabel}
        >
          <div className="checkout-country-select-search-wrapper">
            <input
              type="search"
              className="checkout-country-select-search"
              placeholder={locale === 'ar' ? 'ابحث عن دولة…' : 'Search country…'}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              aria-label={locale === 'ar' ? 'ابحث عن رمز الدولة' : 'Search country code'}
              autoFocus
            />
          </div>
          <ul className="checkout-country-select-options" role="presentation">
            {displayCountries.map((country, index) => {
              const isSelected = country.country === value;
              const isHighlighted = index === highlightedIndex;
              const isPinned = country.pinned === true;
              return (
                <li
                  key={country.country}
                  ref={(el) => {
                    optionsRef.current[index] = el;
                  }}
                  className={`checkout-country-select-option ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''} ${isPinned ? 'is-pinned' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-highlighted={isHighlighted}
                  onClick={() => {
                    onChange({ target: { value: country.country } });
                    setIsOpen(false);
                    setSearchQuery('');
                    setHighlightedIndex(-1);
                    buttonRef.current?.focus();
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="checkout-country-select-option-code">{country.code}</span>
                  <span className="checkout-country-select-option-name">{getCountryName(country)}</span>
                  {isPinned && <span className="checkout-country-select-pinned-badge" aria-label={locale === 'ar' ? 'مثبت' : 'Pinned'}>★</span>}
                </li>
              );
            })}
            {displayCountries.length === 0 && searchQuery.trim() && (
              <li className="checkout-country-select-no-results" role="option" aria-disabled="true">
                {locale === 'ar' ? 'لا توجد نتائج' : 'No results found'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const { items, subtotal, addItem, clearCart } = useCart();
  const { copy, locale } = useI18n();
  const { token, customer } = useAuth();

  // Form state - WhatsApp is OPTIONAL, defaults to unchecked (not same as phone)
  // State uses ISO country codes (PS, IL, US, CA, etc.)
  const [form, setForm] = useState({
    name: '',
    phoneCountry: DEFAULT_COUNTRY,      // ISO country code
    phone: '',
    email: '',
    whatsappSameAsPhone: false,         // Default unchecked - WhatsApp is optional
    whatsappCountry: DEFAULT_COUNTRY,   // ISO country code
    whatsapp: '',
    city: '',
    address: '',
    notes: '',
  });
  const [prepared, setPrepared] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const [zonesStatus, setZonesStatus] = useState('loading'); // loading | ready | empty | error
  const [zones, setZones] = useState([]);
  const [zonesError, setZonesError] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [zonesReloadKey, setZonesReloadKey] = useState(0);

  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  // Handle checkbox changes (boolean values)
  const setBooleanField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.checked }));

  // First-party funnel: a checkout starts when the page is entered (or filled)
  // with a non-empty cart. purchase is never sent from here — the platform
  // order API records it after a confirmed order.
  const checkoutStarted = items.length > 0;
  useEffect(() => {
    if (!checkoutStarted) return undefined;
    trackPlatformEvent('initiate_checkout', {});
    return undefined;
  }, [checkoutStarted]);

  const inCartSlugs = useMemo(() => new Set(items.map((item) => item.slug)), [items]);
  const recommended = useMemo(() => velvetProducts.filter((item) => !inCartSlugs.has(item.slug)).slice(0, 4), [inCartSlugs]);

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) || null,
    [zones, selectedZoneId],
  );

  const previewTotals = useMemo(() => {
    if (!selectedZone) return null;
    return computeCheckoutTotals(subtotal, selectedZone.deliveryPrice);
  }, [subtotal, selectedZone]);

  const loadZones = () => {
    setZonesStatus('loading');
    setZonesError(null);
    setSelectedZoneId('');
    setZonesReloadKey((key) => key + 1);
  };

  useEffect(() => {
    let cancelled = false;
    if (!isStorefrontApiConfigured()) {
      setZones([]);
      setZonesStatus('error');
      setZonesError(copy.checkout.deliveryAreasLoadError);
      return undefined;
    }

    setZonesStatus('loading');
    setZonesError(null);

    fetchDeliveryZones().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setZones([]);
        setSelectedZoneId('');
        setZonesStatus('error');
        // Always show localized copy — never surface raw network strings.
        setZonesError(copy.checkout.deliveryAreasLoadError);
        return;
      }
      setZones(result.zones);
      setSelectedZoneId('');
      if (result.zones.length === 0) {
        setZonesStatus('empty');
        setZonesError(null);
      } else {
        setZonesStatus('ready');
        setZonesError(null);
      }
    }).catch(() => {
      if (cancelled) return;
      setZones([]);
      setSelectedZoneId('');
      setZonesStatus('error');
      setZonesError(copy.checkout.deliveryAreasLoadError);
    });

    return () => { cancelled = true; };
  }, [zonesReloadKey, copy.checkout.deliveryAreasLoadError]);

  const canPlaceOrder = zonesStatus === 'ready'
    && Boolean(selectedZone)
    && !placing
    && items.length > 0;

  // International paste sync for primary phone
  const handlePhoneChange = useCallback((event) => {
    const rawValue = event.target.value;
    setForm((current) => ({ ...current, phone: rawValue }));

    // If user pasted an international number, auto-sync the country selector
    // Use isPossible() to match isValidPhone() acceptance semantics
    if (rawValue.startsWith('+')) {
      const parsed = parsePhoneNumberFromString(rawValue);
      if (parsed && parsed.isPossible() && parsed.country) {
        setForm((current) => ({ ...current, phoneCountry: parsed.country }));
      }
    }
  }, []);

  // International paste sync for WhatsApp
  const handleWhatsAppChange = useCallback((event) => {
    const rawValue = event.target.value;
    setForm((current) => ({ ...current, whatsapp: rawValue }));

    // If user pasted an international number, auto-sync the country selector
    // Use isPossible() to match isValidPhone() acceptance semantics
    if (rawValue.startsWith('+')) {
      const parsed = parsePhoneNumberFromString(rawValue);
      if (parsed && parsed.isPossible() && parsed.country) {
        setForm((current) => ({ ...current, whatsappCountry: parsed.country }));
      }
    }
  }, []);

  const handlePlaceOrder = async (event) => {
    event.preventDefault();
    setError(null);

    if (zonesStatus === 'loading') return;
    if (zonesStatus === 'empty') {
      setError(copy.checkout.noDeliveryAreas);
      return;
    }
    if (zonesStatus === 'error') {
      setError(zonesError || copy.checkout.deliveryAreasLoadError);
      return;
    }
    if (!selectedZone) {
      setError(copy.checkout.selectDeliveryAreaRequired);
      return;
    }

    // Validate PRIMARY phone (REQUIRED) - uses ISO country from selector
    // normalizePhone will auto-detect if user pasted +intl number
    const phoneNorm = normalizePhone(form.phone, form.phoneCountry);
    if (!phoneNorm.phoneNational || phoneNorm.phoneNational.length < 4) {
      setError('Please enter a valid phone number');
      return;
    }
    // Additional validation using libphonenumber-js
    if (!isValidPhone(form.phone, form.phoneCountry)) {
      setError('Please enter a valid phone number');
      return;
    }

    // Validate WhatsApp ONLY if user has entered something AND unchecked "same as phone"
    // WhatsApp is completely optional - no error if empty
    if (!form.whatsappSameAsPhone && form.whatsapp.trim()) {
      const whatsappNorm = normalizeWhatsApp(form.whatsapp, form.whatsappCountry);
      if (!whatsappNorm.whatsappNational || whatsappNorm.whatsappNational.length < 4) {
        setError('Please enter a valid WhatsApp number');
        return;
      }
      if (!isValidPhone(form.whatsapp, form.whatsappCountry)) {
        setError('Please enter a valid WhatsApp number');
        return;
      }
    }

    setPlacing(true);
    try {
      let order = null;
      let orderCreated = false;
      // Real order first when the storefront API is configured. Guest checkout
      // is allowed (no token); logged-in customers attach their Bearer token so
      // the server associates the order with their account.
      if (isStorefrontApiConfigured()) {
        // Build normalized phone data for payload
        // Primary phone: normalizePhone auto-detects +intl pasted numbers
        const phoneData = normalizePhone(form.phone, form.phoneCountry);

        // Build WhatsApp data based on user choice
        let whatsappData;
        if (form.whatsappSameAsPhone) {
          // Checked: use primary phone (already normalized with correct country)
          whatsappData = deriveWhatsAppFromContact(phoneData);
        } else if (form.whatsapp.trim()) {
          // Unchecked with separate number: normalize with auto-sync for pasted intl
          whatsappData = normalizeWhatsApp(form.whatsapp, form.whatsappCountry);
        } else {
          // Unchecked and empty: send empty WhatsApp payload
          whatsappData = createEmptyWhatsAppPayload();
        }

        const payload = buildOrderPayload({
          customer: {
            ...form,
            phone: phoneData.phoneLocal,
            phoneCountryCode: phoneData.phoneCountryCode,
            phoneISO: phoneData.phoneISO,
            phoneNational: phoneData.phoneNational,
            phoneCanonical: phoneData.phoneCanonical,
            phoneLocal: phoneData.phoneLocal,
            whatsappSameAsPhone: form.whatsappSameAsPhone,
            whatsappCountryCode: whatsappData.whatsappCountryCode,
            whatsappISO: whatsappData.whatsappISO,
            whatsappNational: whatsappData.whatsappNational,
            whatsappCanonical: whatsappData.whatsappCanonical,
            whatsappLocal: whatsappData.whatsappLocal,
          },
          items,
          deliveryZone: selectedZone,
        });
        const result = await createOrder(payload, { token });
        if (!result.ok) {
          // Failed request: the cart stays untouched.
          if (isDeliveryZoneRejected(result)) {
            setError(copy.checkout.deliveryAreaUnavailable);
            setSelectedZoneId('');
            loadZones();
          } else {
            setError(result.message || copy.checkout.orderError);
          }
          setPlacing(false);
          return;
        }
        order = result.order;
        orderCreated = true;
        if (customer) persistOrderSnapshot(order, customer);
      }

      // Snapshot everything the WhatsApp message needs from this render before
      // the cart is cleared — clearing the cart must never erase order data.
      const submittedItems = items;
      const submittedForm = form;
      const serverArea = String(order?.delivery_city_name || '').trim();

      // Only a successful POST /api/orders clears the cart (never before the
      // request, never on a failed request or validation error).
      if (orderCreated) clearCart();

      const totals = resolveOrderTotals({
        items: submittedItems,
        order,
        fallbackDeliveryFee: selectedZone.deliveryPrice,
      });

      // Build phone data for WhatsApp (prefer whatsappCanonical for WhatsApp action)
      const phoneData = normalizePhone(submittedForm.phone, submittedForm.phoneCountry);
      let whatsappData;
      if (submittedForm.whatsappSameAsPhone) {
        whatsappData = deriveWhatsAppFromContact(phoneData);
      } else if (submittedForm.whatsapp.trim()) {
        whatsappData = normalizeWhatsApp(submittedForm.whatsapp, submittedForm.whatsappCountry);
      } else {
        whatsappData = createEmptyWhatsAppPayload();
      }

      const message = buildWhatsAppOrderMessage({
        customer: {
          ...submittedForm,
          phone: phoneData.phoneLocal, // Display local format in message
        },
        items: submittedItems,
        subtotal: totals.subtotal,
        deliveryArea: serverArea || selectedZone.cityName,
        deliveryFee: totals.deliveryFee,
        finalTotal: totals.finalTotal,
        orderNumber: order?.orderNumber || order?.id || '',
        status: order?.status || '',
      });
      const url = buildWhatsAppOrderUrl(message);
      const opened = openWhatsAppOrder(url);
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

  const deliverySummaryValue = (() => {
    if (zonesStatus === 'loading') return copy.checkout.loadingDeliveryAreas;
    if (zonesStatus === 'error') return copy.checkout.deliveryAreasLoadError;
    if (zonesStatus === 'empty') return copy.checkout.noDeliveryAreas;
    if (!selectedZone) return copy.checkout.selectDeliveryArea;
    return formatPrice(selectedZone.deliveryPrice);
  })();

  const totalSummaryValue = previewTotals
    ? formatPrice(previewTotals.finalTotal)
    : '—';

  // Phone + WhatsApp UI components
  const PhoneField = () => (
    <div className="checkout-field checkout-field--phone">
      <label htmlFor="checkout-phone">{copy.checkout.phone}</label>
      <div className="checkout-phone-input">
        <CountrySelect
          id="checkout-phone-country"
          value={form.phoneCountry}
          onChange={setField('phoneCountry')}
          ariaLabel={copy.checkout.phoneCountryCode}
          locale={locale}
        />
        <input
          id="checkout-phone"
          required
          value={form.phone}
          onChange={handlePhoneChange}
          placeholder={copy.checkout.phonePlaceholder}
          name="phone"
          type="tel"
          autoComplete="tel"
          className="checkout-phone-national"
          dir="ltr"
        />
      </div>
    </div>
  );

  const WhatsAppField = () => (
    <div className="checkout-field checkout-field--whatsapp">
      <fieldset className="checkout-whatsapp-fieldset">
        <legend className="checkout-whatsapp-legend">{copy.checkout.whatsapp}</legend>
        <div className="checkout-whatsapp-toggle">
          <input
            type="checkbox"
            id="checkout-whatsapp-same"
            checked={form.whatsappSameAsPhone}
            onChange={setBooleanField('whatsappSameAsPhone')}
          />
          <label htmlFor="checkout-whatsapp-same">{copy.checkout.whatsappSameAsPhone}</label>
        </div>
        {!form.whatsappSameAsPhone && (
          <div className="checkout-whatsapp-input">
            <div className="checkout-phone-input">
              <CountrySelect
                id="checkout-whatsapp-country"
                value={form.whatsappCountry}
                onChange={setField('whatsappCountry')}
                ariaLabel={copy.checkout.whatsappCountryCode}
                locale={locale}
              />
              <input
                id="checkout-whatsapp"
                value={form.whatsapp}
                onChange={handleWhatsAppChange}
                placeholder={copy.checkout.whatsappPlaceholder}
                name="whatsapp"
                type="tel"
                autoComplete="tel"
                className="checkout-phone-national"
                dir="ltr"
              />
            </div>
            <p className="checkout-whatsapp-hint">
              {locale === 'ar'
                ? 'اختياري. اتركه فارغاً إذا لم يكن لديك واتساب منفصل.'
                : 'Optional. Leave empty if you don\'t have a separate WhatsApp number.'}
            </p>
          </div>
        )}
      </fieldset>
    </div>
  );

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
                  const itemName = getProductName(item, locale);
                  const product = velvetProducts.find((p) => p.slug === item.slug);
                  const variants = getCustomerFacingSelectionLabels(product, item.selections || {}, locale).join(' · ');
                  return (
                    <li className={`checkout-gallery__item ${index === 0 ? 'checkout-gallery__item--lead' : ''}`} key={item.key}>
                      <Link className="checkout-gallery__link" to={`/products/${item.slug}`} aria-label={`${copy.products.view} ${itemName}`}><img src={item.image} alt={itemName} /></Link>
                      <div className="checkout-gallery__caption">
                        <Link to={`/products/${item.slug}`}><h3>{itemName}</h3></Link>
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
                <div>
                  <dt>{copy.checkout.deliveryFee}</dt>
                  <dd data-testid="checkout-delivery-fee">{deliverySummaryValue}</dd>
                </div>
                <div className="checkout-summary__grand">
                  <dt>{copy.checkout.total}</dt>
                  <dd data-testid="checkout-final-total">{totalSummaryValue}</dd>
                </div>
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
                <div className="checkout-field-row checkout-field-row--phone">
                  <PhoneField />
                  <div className="checkout-field">
                    <label htmlFor="checkout-email">{copy.checkout.email}</label>
                    <input id="checkout-email" required value={form.email} onChange={setField('email')} placeholder={copy.checkout.emailPlaceholder} name="email" type="email" autoComplete="email" />
                  </div>
                </div>
                <WhatsAppField />
                <div className="checkout-field">
                  <label htmlFor="checkout-city">{copy.checkout.city}</label>
                  <input id="checkout-city" required value={form.city} onChange={setField('city')} placeholder={copy.checkout.cityPlaceholder} name="city" autoComplete="address-level2" />
                </div>
                <div className="checkout-field">
                  <label htmlFor="checkout-address">{copy.checkout.address}</label>
                  <input id="checkout-address" required value={form.address} onChange={setField('address')} placeholder={copy.checkout.addressPlaceholder} name="address" autoComplete="street-address" />
                </div>

                <div className="checkout-field checkout-field--delivery">
                  <label htmlFor="checkout-delivery-area">{copy.checkout.deliveryArea}</label>
                  {zonesStatus === 'loading' ? (
                    <p className="checkout-delivery-status" role="status">{copy.checkout.loadingDeliveryAreas}</p>
                  ) : null}
                  {zonesStatus === 'error' ? (
                    <div className="checkout-delivery-status checkout-delivery-status--error" role="alert">
                      <p>{zonesError || copy.checkout.deliveryAreasLoadError}</p>
                      <button type="button" className="store-secondary-button checkout-delivery-retry" onClick={loadZones}>
                        {copy.checkout.retryDeliveryAreas}
                      </button>
                    </div>
                  ) : null}
                  {zonesStatus === 'empty' ? (
                    <p className="checkout-delivery-status checkout-delivery-status--error" role="status">
                      {copy.checkout.noDeliveryAreas}
                    </p>
                  ) : null}
                  {zonesStatus === 'ready' ? (
                    <select
                      id="checkout-delivery-area"
                      name="deliveryZoneId"
                      required
                      value={selectedZoneId}
                      onChange={(event) => {
                        setSelectedZoneId(event.target.value);
                        setError(null);
                      }}
                      aria-required="true"
                    >
                      <option value="">{copy.checkout.selectDeliveryArea}</option>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.cityName}
                          {zone.region ? ` — ${zone.region}` : ''}
                          {' '}
                          {formatPrice(zone.deliveryPrice)}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>

                <div className="checkout-field">
                  <label htmlFor="checkout-notes">{copy.checkout.notes}</label>
                  <textarea id="checkout-notes" value={form.notes} onChange={setField('notes')} placeholder={copy.checkout.notesPlaceholder} name="notes" rows={3} />
                </div>
              </div>

              {error ? (
                <p className="auth-panel__status auth-panel__status--error" role="status">{error}</p>
              ) : null}

              <button
                className="store-primary-button checkout-panel__cta"
                type="submit"
                disabled={!canPlaceOrder}
              >
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