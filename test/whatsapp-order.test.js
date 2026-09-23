import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { socialLinks } from '../src/data/socialLinks.js';
import {
  buildWhatsAppOrderMessage,
  buildWhatsAppOrderUrl,
  getOfficialWhatsAppPhone,
  localizeOptionLabel,
  openWhatsAppOrder,
  resolveOptionValue,
  resolveProductDisplayName,
} from '../src/data/whatsappOrder.js';
import { translations } from '../src/i18n/translations.js';

const checkoutPage = fs.readFileSync(new URL('../src/pages/CheckoutPage.jsx', import.meta.url), 'utf8');

const sampleCustomer = {
  name: 'سارة أحمد',
  phone: '0598123456',
  email: 'sara@example.com',
  city: 'رام الله',
  address: 'شارع الإرسال، عمارة 3',
  notes: 'التوصيل بعد الظهر',
};

const sampleItems = [
  {
    name: 'Stack Tower',
    nameAr: 'برج التكديس',
    price: 24.5,
    quantity: 2,
    selections: { Color: 'Blue', Size: 'M' },
  },
  {
    name: 'Soft Bunny',
    nameAr: '',
    price: 15,
    quantity: 1,
    selections: {},
  },
];

test('official WhatsApp phone comes from socialLinks', () => {
  assert.equal(getOfficialWhatsAppPhone(), '970598431743');
  assert.equal(getOfficialWhatsAppPhone(socialLinks.whatsapp), '970598431743');
  assert.match(socialLinks.whatsapp, /phone=970598431743/);
});

test('Arabic product name is preferred with English fallback', () => {
  assert.equal(resolveProductDisplayName({ name: 'Soft Bunny', nameAr: 'أرنب ناعم' }), 'أرنب ناعم');
  assert.equal(resolveProductDisplayName({ name: 'Soft Bunny', nameAr: '' }), 'Soft Bunny');
  assert.equal(resolveProductDisplayName({ name: 'Soft Bunny' }), 'Soft Bunny');
});

test('recognized option labels localize to Arabic; unknown labels stay original', () => {
  assert.equal(localizeOptionLabel('Color'), 'اللون');
  assert.equal(localizeOptionLabel('Size'), 'المقاس');
  assert.equal(localizeOptionLabel('Material'), 'الخامة');
  assert.equal(localizeOptionLabel('Style'), 'النمط');
  assert.equal(localizeOptionLabel('Age'), 'العمر');
  assert.equal(localizeOptionLabel('Type'), 'النوع');
  assert.equal(localizeOptionLabel('Edition'), 'Edition');
  assert.equal(localizeOptionLabel('اللون'), 'اللون');
});

test('option values prefer already-Arabic text and otherwise keep the selection', () => {
  assert.equal(resolveOptionValue('Blue', 'أزرق'), 'أزرق');
  assert.equal(resolveOptionValue('Blue'), 'Blue');
  assert.equal(resolveOptionValue('أزرق'), 'أزرق');
  assert.equal(resolveOptionValue({ label: 'Blue', labelAr: 'أزرق' }.label, { label: 'Blue', labelAr: 'أزرق' }.labelAr), 'أزرق');
});

test('WhatsApp order message is Arabic and includes customer, items, totals, and status', () => {
  const message = buildWhatsAppOrderMessage({
    customer: sampleCustomer,
    items: [
      ...sampleItems.slice(0, 1),
      {
        name: 'Soft Bunny',
        nameAr: '',
        price: 15,
        quantity: 1,
        selections: { Color: { label: 'Blue', labelAr: 'أزرق' } },
      },
    ],
    subtotal: 64,
  });

  assert.match(message, /^طلب جديد من متجر VELVET/);
  assert.match(message, /حالة الطلب: جديد/);
  assert.match(message, /الاسم: سارة أحمد/);
  assert.match(message, /رقم الهاتف: 0598123456/);
  assert.match(message, /البريد الإلكتروني: sara@example\.com/);
  assert.match(message, /المدينة: رام الله/);
  assert.match(message, /العنوان: شارع الإرسال، عمارة 3/);
  assert.match(message, /1\. برج التكديس/);
  assert.match(message, /الكمية: 2/);
  assert.match(message, /السعر: ₪24\.50/);
  assert.match(message, /الخيارات: اللون: Blue، المقاس: M/);
  assert.match(message, /الإجمالي: ₪49\.00/);
  assert.match(message, /2\. Soft Bunny/);
  assert.match(message, /الخيارات: اللون: أزرق/);
  assert.match(message, /الكمية: 1/);
  assert.match(message, /السعر: ₪15\.00/);
  assert.match(message, /الإجمالي: ₪15\.00/);
  assert.match(message, /المجموع الفرعي: ₪64\.00/);
  assert.match(message, /التوصيل: مجاني/);
  assert.match(message, /الإجمالي النهائي: ₪64\.00/);
  assert.match(message, /ملاحظات العميل:\nالتوصيل بعد الظهر/);
  assert.doesNotMatch(message, /undefined|null/);
  assert.doesNotMatch(message, /الخيارات: Color:/);
  assert.doesNotMatch(message, /\$\d/);
});

test('empty notes are omitted cleanly from the Arabic message', () => {
  const message = buildWhatsAppOrderMessage({
    customer: { ...sampleCustomer, notes: '   ' },
    items: sampleItems.slice(0, 1),
    subtotal: 49,
  });
  assert.doesNotMatch(message, /ملاحظات العميل/);
});

test('WhatsApp URL encodes the Arabic message and keeps the official number', () => {
  const message = buildWhatsAppOrderMessage({
    customer: sampleCustomer,
    items: sampleItems,
    subtotal: 64,
  });
  const url = buildWhatsAppOrderUrl(message);
  assert.match(url, /^https:\/\/api\.whatsapp\.com\/send\/\?phone=970598431743&text=/);
  assert.match(url, /type=phone_number&app_absent=0$/);
  const encoded = new URL(url).searchParams.get('text');
  assert.equal(encoded, message);
  assert.match(encoded, /حالة الطلب: جديد/);
  assert.equal(encodeURIComponent(message), url.match(/text=([^&]+)/)[1]);
});

test('openWhatsAppOrder reports whether a window context opened', () => {
  assert.equal(openWhatsAppOrder('https://example.com', () => ({ closed: false })), true);
  assert.equal(openWhatsAppOrder('https://example.com', () => null), false);
  assert.equal(openWhatsAppOrder('', () => ({ closed: false })), false);
});

test('checkout page wires WhatsApp order flow without fake backend success', () => {
  assert.match(checkoutPage, /buildWhatsAppOrderMessage/);
  assert.match(checkoutPage, /buildWhatsAppOrderUrl/);
  assert.match(checkoutPage, /openWhatsAppOrder/);
  assert.match(checkoutPage, /setPrepared/);
  // Real order creation is wired first (POST /api/orders via createOrder);
  // the WhatsApp message then carries the real orderNumber + status.
  assert.match(checkoutPage, /createOrder/);
  assert.match(checkoutPage, /orderNumber/);
  assert.match(checkoutPage, /orderStatus/);
  assert.doesNotMatch(checkoutPage, /clearCart/);
  assert.doesNotMatch(checkoutPage, /Order placed!/);
});

test('checkout success copy is honest in EN and AR', () => {
  assert.equal(translations.ar.checkout.successTitle, 'تم تجهيز طلبك');
  assert.equal(
    translations.ar.checkout.successBody,
    'أكمل إرسال الطلب عبر واتساب ليصل إلى فريق VELVET.',
  );
  assert.equal(translations.ar.checkout.whatsappSend, 'إرسال الطلب عبر واتساب');
  assert.equal(translations.en.checkout.successTitle, 'Your order is ready');
  assert.match(translations.en.checkout.successBody, /WhatsApp/);
  assert.equal(translations.en.checkout.whatsappSend, 'Send order via WhatsApp');
});
