import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { computeCheckoutTotals } from '../src/data/deliveryZones.js';
import { buildOrderPayload } from '../src/data/orders.js';
import { computeOrderSubtotal, resolveOrderTotals } from '../src/data/orderTotals.js';
import { buildWhatsAppOrderUrl, buildWhatsAppOrderMessage } from '../src/data/whatsappOrder.js';

const checkoutPage = fs.readFileSync(new URL('../src/pages/CheckoutPage.jsx', import.meta.url), 'utf8');
const cartContext = fs.readFileSync(new URL('../src/context/CartContext.jsx', import.meta.url), 'utf8');

// Confirmed regression case: unit price 18, quantity 5, delivery 20.
const regressionItem = {
  key: 'p1|',
  productId: 'p1',
  slug: 'p1',
  name: 'Stack Tower',
  nameAr: 'برج التكديس',
  price: 18,
  quantity: 5,
  selections: {},
  variantId: '',
};

const regressionCustomer = {
  name: 'سارة أحمد',
  phone: '0598123456',
  email: 'sara@example.com',
  city: 'رام الله',
  address: 'شارع الإرسال، عمارة 3',
  notes: '',
};

test('authoritative subtotal is sum(unitPrice * quantity): 18 × 5 = 90', () => {
  assert.equal(computeOrderSubtotal([regressionItem]), 90);
  // Checkout UI preview uses the same subtotal + selected zone fee.
  assert.deepEqual(computeCheckoutTotals(computeOrderSubtotal([regressionItem]), 20), {
    subtotal: 90,
    deliveryFee: 20,
    finalTotal: 110,
  });
});

test('submitted/saved order totals are 90 + 20 = 110', () => {
  const totals = resolveOrderTotals({
    items: [regressionItem],
    order: { subtotal: 90, delivery_price: 20, total: 110 },
    fallbackDeliveryFee: 20,
  });
  assert.deepEqual(totals, { subtotal: 90, deliveryFee: 20, finalTotal: 110 });

  // Payload still submits the submitted quantity and never a client fee.
  const payload = buildOrderPayload({
    customer: regressionCustomer,
    items: [regressionItem],
    deliveryZone: { id: 'zone-a', cityKey: 'ramallah', deliveryPrice: 20 },
  });
  assert.equal(payload.items[0].quantity, 5);
  assert.equal(payload.deliveryZoneId, 'zone-a');
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'delivery_price'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'deliveryFee'), false);
});

test('stale server subtotal 75 / total 95 is rejected: totals stay 90/20/110', () => {
  const totals = resolveOrderTotals({
    items: [regressionItem],
    order: { subtotal: 75, delivery_price: 20, total: 95 },
    fallbackDeliveryFee: 20,
  });
  assert.deepEqual(totals, { subtotal: 90, deliveryFee: 20, finalTotal: 110 });
});

test('no returned order → subtotal from cart lines + selected zone fee', () => {
  const totals = resolveOrderTotals({
    items: [regressionItem],
    order: null,
    fallbackDeliveryFee: 20,
  });
  assert.deepEqual(totals, { subtotal: 90, deliveryFee: 20, finalTotal: 110 });
});

test('WhatsApp message: 5 × 18 = 90 with subtotal 90, delivery 20, total 110', () => {
  const totals = resolveOrderTotals({
    items: [regressionItem],
    order: { subtotal: 75, delivery_price: 20, total: 95 },
    fallbackDeliveryFee: 20,
  });
  const message = buildWhatsAppOrderMessage({
    customer: regressionCustomer,
    items: [regressionItem],
    subtotal: totals.subtotal,
    deliveryArea: 'رام الله',
    deliveryFee: totals.deliveryFee,
    finalTotal: totals.finalTotal,
    orderNumber: 'ORD-1',
    status: 'Pending',
  });

  assert.match(message, /الكمية: 5/);
  assert.match(message, /السعر: ₪18\.00/);
  assert.match(message, /الإجمالي: ₪90\.00/);
  assert.match(message, /المجموع الفرعي: ₪90\.00/);
  assert.match(message, /رسوم التوصيل: ₪20\.00/);
  assert.match(message, /الإجمالي النهائي: ₪110\.00/);
  assert.doesNotMatch(message, /₪75\.00|₪95\.00/);

  const url = buildWhatsAppOrderUrl(message);
  assert.equal(new URL(url).searchParams.get('text'), message);
});

test('checkout resolves one totals source and builds WhatsApp after the clear', () => {
  assert.match(checkoutPage, /const \{\s*items, subtotal, addItem, clearCart \} = useCart\(\)/);
  assert.match(checkoutPage, /resolveOrderTotals\(\{/);
  assert.match(checkoutPage, /items: submittedItems/);
  assert.match(checkoutPage, /subtotal: totals\.subtotal/);
  assert.match(checkoutPage, /deliveryFee: totals\.deliveryFee/);
  assert.match(checkoutPage, /finalTotal: totals\.finalTotal/);
  assert.match(checkoutPage, /fallbackDeliveryFee: selectedZone\.deliveryPrice/);

  const successStart = checkoutPage.indexOf('order = result.order;');
  const clearAt = checkoutPage.indexOf('clearCart()');
  const messageAt = checkoutPage.indexOf('buildWhatsAppOrderMessage({');
  assert.ok(successStart > -1 && clearAt > successStart, 'clearCart must run after the successful order response');
  assert.ok(messageAt > clearAt, 'WhatsApp message must be built from the pre-clear snapshot after clearCart');
  // Pre-clear snapshot keeps the data needed for the WhatsApp message.
  assert.match(checkoutPage, /const submittedItems = items;/);
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
  const storage = new Map([[STORAGE_KEY, JSON.stringify([regressionItem])]]);
  const readStoredCart = () => {
    try {
      const value = JSON.parse(storage.get(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  assert.equal(readStoredCart().length, 1);
  // clearCart() → items = [] → provider effect persists [].
  storage.set(STORAGE_KEY, JSON.stringify([]));
  assert.deepEqual(readStoredCart(), []);
});
