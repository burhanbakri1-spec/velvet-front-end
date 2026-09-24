import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  computeCheckoutTotals,
  isDeliveryZoneRejected,
  normalizeDeliveryZone,
  sortDeliveryZones,
} from '../src/data/deliveryZones.js';
import { buildOrderPayload } from '../src/data/orders.js';
import { buildWhatsAppOrderMessage } from '../src/data/whatsappOrder.js';
import { translations } from '../src/i18n/translations.js';

const checkoutPage = fs.readFileSync(new URL('../src/pages/CheckoutPage.jsx', import.meta.url), 'utf8');
const deliveryZonesModule = fs.readFileSync(new URL('../src/data/deliveryZones.js', import.meta.url), 'utf8');
const ordersModule = fs.readFileSync(new URL('../src/data/orders.js', import.meta.url), 'utf8');
const whatsappModule = fs.readFileSync(new URL('../src/data/whatsappOrder.js', import.meta.url), 'utf8');

const sampleZones = [
  {
    id: 'zone-a',
    city_key: 'ramallah',
    city_name: 'Ramallah',
    region: 'West Bank',
    delivery_price: 20,
    currency: 'ILS',
    enabled: true,
    display_order: 2,
  },
  {
    id: 'zone-b',
    city_key: 'nablus',
    city_name: 'Nablus',
    region: 'West Bank',
    delivery_price: 30,
    currency: 'ILS',
    enabled: true,
    display_order: 1,
  },
  {
    id: 'zone-off',
    city_key: 'disabled-city',
    city_name: 'Disabled',
    delivery_price: 5,
    enabled: false,
    display_order: 0,
  },
];

test('A) active zones normalize and sort for the selector', () => {
  const zones = sortDeliveryZones(sampleZones.map(normalizeDeliveryZone).filter(Boolean));
  assert.equal(zones.length, 2);
  assert.equal(zones[0].id, 'zone-b');
  assert.equal(zones[0].cityName, 'Nablus');
  assert.equal(zones[0].deliveryPrice, 30);
  assert.equal(zones[1].id, 'zone-a');
  assert.equal(zones[1].deliveryPrice, 20);
  assert.match(checkoutPage, /fetchDeliveryZones/);
  assert.match(checkoutPage, /checkout-delivery-area/);
  assert.match(checkoutPage, /zones\.map/);
  assert.match(deliveryZonesModule, /\/api\/delivery-zones/);
});

test('B) select zone fee 20 with subtotal 100 → final total 120', () => {
  const totals = computeCheckoutTotals(100, 20);
  assert.deepEqual(totals, { subtotal: 100, deliveryFee: 20, finalTotal: 120 });
});

test('C) change zone fee 30 → total updates to 130', () => {
  const totals = computeCheckoutTotals(100, 30);
  assert.equal(totals.finalTotal, 130);
});

test('D) no zone selected → order cannot submit', () => {
  assert.match(checkoutPage, /selectDeliveryAreaRequired/);
  assert.match(checkoutPage, /canPlaceOrder/);
  assert.match(checkoutPage, /Boolean\(selectedZone\)/);
  assert.match(checkoutPage, /disabled=\{!canPlaceOrder\}/);
});

test('E) no active zones → checkout disabled with message', () => {
  assert.match(checkoutPage, /zonesStatus === 'empty'/);
  assert.match(checkoutPage, /noDeliveryAreas/);
  assert.match(checkoutPage, /canPlaceOrder = zonesStatus === 'ready'/);
});

test('F) API load failure → no free-delivery fallback', () => {
  assert.match(checkoutPage, /zonesStatus === 'error'/);
  assert.match(checkoutPage, /deliveryAreasLoadError/);
  assert.doesNotMatch(checkoutPage, /shippingLabel:\s*'مجاني'/);
  assert.doesNotMatch(checkoutPage, /copy\.checkout\.free/);
  assert.doesNotMatch(deliveryZonesModule, /FREE_DELIVERY|fallbackZones\s*=/);
  assert.match(deliveryZonesModule, /Never invents fallback zones/);
});

test('G) order payload contains deliveryZoneId', () => {
  const payload = buildOrderPayload({
    customer: {
      name: 'Sara',
      phone: '0598123456',
      email: 'sara@example.com',
      city: 'Ramallah',
      address: 'Street 1',
    },
    items: [{ productId: 'p1', variantId: 'v1', quantity: 2 }],
    deliveryZone: {
      id: 'zone-a',
      cityKey: 'ramallah',
      cityName: 'Ramallah',
      deliveryPrice: 20,
    },
  });
  assert.equal(payload.deliveryZoneId, 'zone-a');
  assert.equal(payload.delivery_city_key, 'ramallah');
  assert.equal(payload.items.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'delivery_price'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'deliveryFee'), false);
  assert.match(ordersModule, /deliveryZoneId/);
});

test('H) backend rejects disabled/invalid zone → localized checkout error', () => {
  assert.equal(
    isDeliveryZoneRejected({
      ok: false,
      status: 400,
      message: 'Selected delivery city is not available.',
    }),
    true,
  );
  assert.equal(
    isDeliveryZoneRejected({ ok: false, status: 500, message: 'Server error' }),
    false,
  );
  assert.match(checkoutPage, /isDeliveryZoneRejected/);
  assert.match(checkoutPage, /deliveryAreaUnavailable/);
});

test('I) WhatsApp message includes zone, delivery fee, and final total', () => {
  const message = buildWhatsAppOrderMessage({
    customer: {
      name: 'سارة',
      phone: '0598',
      email: 'a@b.com',
      city: 'رام الله',
      address: 'شارع 1',
    },
    items: [{ name: 'Toy', nameAr: 'لعبة', price: 100, quantity: 1, selections: {} }],
    subtotal: 100,
    deliveryArea: 'رام الله',
    deliveryFee: 20,
    finalTotal: 120,
    orderNumber: 'ORD-1',
    status: 'Pending',
  });
  assert.match(message, /منطقة التوصيل: رام الله/);
  assert.match(message, /رسوم التوصيل: ₪20\.00/);
  assert.match(message, /الإجمالي النهائي: ₪120\.00/);
  assert.doesNotMatch(message, /مجاني/);
  assert.doesNotMatch(whatsappModule, /shippingLabel\s*=\s*'مجاني'/);
});

test('J) Arabic + English delivery copy exists', () => {
  const en = translations.en.checkout;
  const ar = translations.ar.checkout;
  for (const key of [
    'deliveryArea',
    'selectDeliveryArea',
    'deliveryFee',
    'loadingDeliveryAreas',
    'noDeliveryAreas',
    'deliveryAreaUnavailable',
    'deliveryAreasLoadError',
    'selectDeliveryAreaRequired',
    'retryDeliveryAreas',
  ]) {
    assert.ok(String(en[key] || '').trim(), `missing EN ${key}`);
    assert.ok(String(ar[key] || '').trim(), `missing AR ${key}`);
  }
  assert.match(ar.deliveryArea, /منطقة/);
  assert.match(en.deliveryArea, /Delivery Area/i);
});
