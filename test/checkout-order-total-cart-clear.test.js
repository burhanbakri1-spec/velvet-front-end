import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { computeCheckoutTotals } from '../src/data/deliveryZones.js';
import { buildOrderPayload } from '../src/data/orders.js';
import { computeOrderSubtotal, resolveOrderTotals } from '../src/data/orderTotals.js';
import { buildWhatsAppOrderUrl, buildWhatsAppOrderMessage } from '../src/data/whatsappOrder.js';

const checkoutPage = fs.readFileSync(new URL('../src/pages/CheckoutPage.jsx', import.meta.url), 'utf8');
const cartContext = fs.readFileSync(new URL('../src/context/CartContext.jsx', import.meta.url), 'utf8');
const orderTotalsModule = fs.readFileSync(new URL('../src/data/orderTotals.js', import.meta.url), 'utf8');

// Confirmed server regression: velvet-src-104 at ₪15 × 5 = 75, delivery 20,
// total 95. This is what POST /api/orders returns and what CPanel stores.
const serverOrder = { subtotal: 75, delivery_price: 20, total: 95 };

const checkoutItem = {
  key: 'p1|',
  productId: 'p1',
  slug: 'velvet-src-104',
  name: 'Velvet SRC 104',
  nameAr: 'فلفت ١٠٤',
  price: 15,
  quantity: 5,
  selections: {},
  variantId: '',
};

// Same cart lines but with a stale cached unit price (18) left over from the
// pre-fix catalog. Server money must still win over this 18 × 5 = 90 math.
const staleCartItem = { ...checkoutItem, price: 18 };

const regressionCustomer = {
  name: 'سارة أحمد',
  phone: '0598123456',
  email: 'sara@example.com',
  city: 'رام الله',
  address: 'شارع الإرسال، عمارة 3',
  notes: '',
};

function buildMessage({ items, order, fallbackDeliveryFee = 20 }) {
  const totals = resolveOrderTotals({ items, order, fallbackDeliveryFee });
  return buildWhatsAppOrderMessage({
    customer: regressionCustomer,
    items,
    subtotal: totals.subtotal,
    deliveryArea: 'رام الله',
    deliveryFee: totals.deliveryFee,
    finalTotal: totals.finalTotal,
    orderNumber: 'ORD-1',
    status: 'Pending',
  });
}

test('server order response is authoritative: subtotal 75 / delivery 20 / total 95', () => {
  assert.deepEqual(
    resolveOrderTotals({ items: [checkoutItem], order: serverOrder, fallbackDeliveryFee: 20 }),
    { subtotal: 75, deliveryFee: 20, finalTotal: 95 },
  );

  // Even when the local cart math disagrees (stale ₪18 × 5 = 90), the created
  // order's money is used verbatim — never re-derived, never rejected.
  assert.deepEqual(
    resolveOrderTotals({ items: [staleCartItem], order: serverOrder, fallbackDeliveryFee: 20 }),
    { subtotal: 75, deliveryFee: 20, finalTotal: 95 },
  );
  assert.equal(computeOrderSubtotal([staleCartItem]), 90);
});

test('the old client-side override logic is gone', () => {
  assert.doesNotMatch(orderTotalsModule, /nearlyEqual|isPricedLine|clientSubtotal/);
  assert.doesNotMatch(orderTotalsModule, /stale .*rejected|disagrees with the submitted/);
  // Server money is read straight from the created order.
  assert.match(orderTotalsModule, /serverSubtotal \?\?/);
  assert.match(orderTotalsModule, /serverTotal \?\?/);
});

test('no created order (API off) → fallback to cart lines + selected zone fee', () => {
  assert.deepEqual(
    resolveOrderTotals({ items: [checkoutItem], order: null, fallbackDeliveryFee: 20 }),
    { subtotal: 75, deliveryFee: 20, finalTotal: 95 },
  );
  assert.deepEqual(computeCheckoutTotals(computeOrderSubtotal([checkoutItem]), 20), {
    subtotal: 75,
    deliveryFee: 20,
    finalTotal: 95,
  });
});

test('payload still submits quantity + zone only, never client money', () => {
  const payload = buildOrderPayload({
    customer: regressionCustomer,
    items: [checkoutItem],
    deliveryZone: { id: 'zone-a', cityKey: 'ramallah', deliveryPrice: 20 },
  });
  assert.equal(payload.items[0].quantity, 5);
  assert.equal(payload.deliveryZoneId, 'zone-a');
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'delivery_price'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'deliveryFee'), false);
});

test('WhatsApp shows the server totals 75 / 20 / 95 with the item snapshot', () => {
  const message = buildMessage({ items: [checkoutItem], order: serverOrder });

  // Item display comes from the pre-clear snapshot (name + quantity).
  assert.match(message, /1\. فلفت ١٠٤/);
  assert.match(message, /الكمية: 5/);
  assert.match(message, /السعر: ₪15\.00/);
  // Money comes from the created order.
  assert.match(message, /المجموع الفرعي: ₪75\.00/);
  assert.match(message, /رسوم التوصيل: ₪20\.00/);
  assert.match(message, /الإجمالي النهائي: ₪95\.00/);
  assert.doesNotMatch(message, /₪90\.00|₪110\.00/);

  const url = buildWhatsAppOrderUrl(message);
  assert.equal(new URL(url).searchParams.get('text'), message);
});

test('stale cart prices never force 90 / 110 over the server 75 / 95', () => {
  const message = buildMessage({ items: [staleCartItem], order: serverOrder });

  assert.match(message, /المجموع الفرعي: ₪75\.00/);
  assert.match(message, /رسوم التوصيل: ₪20\.00/);
  assert.match(message, /الإجمالي النهائي: ₪95\.00/);
  assert.doesNotMatch(message, /المجموع الفرعي: ₪90\.00/);
  assert.doesNotMatch(message, /الإجمالي النهائي: ₪110\.00/);
});

test('checkout resolves totals from the order and builds WhatsApp after the clear', () => {
  assert.match(checkoutPage, /const \{\s*items, subtotal, addItem, clearCart \} = useCart\(\)/);
  assert.match(checkoutPage, /resolveOrderTotals\(\{/);
  assert.match(checkoutPage, /items: submittedItems/);
  assert.match(checkoutPage, /order,\r?\n\s*fallbackDeliveryFee: selectedZone\.deliveryPrice,/);
  assert.match(checkoutPage, /subtotal: totals\.subtotal/);
  assert.match(checkoutPage, /deliveryFee: totals\.deliveryFee/);
  assert.match(checkoutPage, /finalTotal: totals\.finalTotal/);

  const successStart = checkoutPage.indexOf('order = result.order;');
  const clearAt = checkoutPage.indexOf('clearCart()');
  const messageAt = checkoutPage.indexOf('buildWhatsAppOrderMessage({');
  assert.ok(successStart > -1 && clearAt > successStart, 'clearCart must run after the successful order response');
  assert.ok(messageAt > clearAt, 'WhatsApp message must be built from the pre-clear snapshot after clearCart');
  // Pre-clear snapshot keeps the item display data for the WhatsApp message.
  assert.match(checkoutPage, /const submittedItems = items;/);
  assert.match(checkoutPage, /const submittedForm = form;/);
  assert.match(checkoutPage, /if \(orderCreated\) clearCart\(\);/);
});

test('failed order does NOT clear the cart', () => {
  const failureBranch = checkoutPage.slice(
    checkoutPage.indexOf('if (!result.ok)'),
    checkoutPage.indexOf('order = result.order;'),
  );
  assert.ok(failureBranch.includes('return;'), 'failed createOrder must return early');
  assert.ok(!failureBranch.includes('clearCart'), 'failed createOrder must not clear the cart');

  const catchBlock = checkoutPage.slice(
    checkoutPage.indexOf('} catch {'),
    checkoutPage.indexOf('} finally {'),
  );
  assert.ok(!catchBlock.includes('clearCart'), 'thrown errors must not clear the cart');

  // Validation errors return before any request and before any clear.
  const guardBlock = checkoutPage.slice(
    checkoutPage.indexOf('const handlePlaceOrder'),
    checkoutPage.indexOf('setPlacing(true);'),
  );
  assert.ok(!guardBlock.includes('clearCart'), 'validation errors must not clear the cart');
});

test('clearCart empties React state, the badge count, and localStorage', () => {
  assert.match(cartContext, /const STORAGE_KEY = 'play-store-cart-v1'/);
  assert.match(cartContext, /const clearCart = \(\) => setItems\(\[\]\)/);
  assert.match(cartContext, /window\.localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(items\)\)/);
  assert.match(cartContext, /useEffect\(\(\) => \{[\s\S]*setItem\(STORAGE_KEY, JSON\.stringify\(items\)\)[\s\S]*\}, \[items\]\)/);
  assert.match(cartContext, /const itemCount = items\.reduce\(\(sum, item\) => sum \+ item\.quantity, 0\)/);

  // Refresh simulation: after clearCart the persisted cart reloads as empty.
  const STORAGE_KEY = 'play-store-cart-v1';
  const storage = new Map([[STORAGE_KEY, JSON.stringify([checkoutItem])]]);
  const readStoredCart = () => {
    try {
      const value = JSON.parse(storage.get(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const badgeOf = (list) => list.reduce((sum, item) => sum + item.quantity, 0);

  assert.equal(readStoredCart().length, 1);
  assert.equal(badgeOf(readStoredCart()), 5);

  // clearCart() → items = [] → provider effect persists [] → badge 0.
  const cleared = [];
  storage.set(STORAGE_KEY, JSON.stringify(cleared));
  assert.deepEqual(readStoredCart(), []);
  assert.equal(badgeOf(readStoredCart()), 0);
});
