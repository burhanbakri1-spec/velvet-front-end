import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { translations } from '../src/i18n/translations.js';
import { buildQrImageUrl } from '../src/data/productShare.js';

const carousel = fs.readFileSync(new URL('../src/components/ProductDetailInfoCarousel.jsx', import.meta.url), 'utf8');
const slide = fs.readFileSync(new URL('../src/components/ProductDetailSlide.jsx', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../src/pages/ProductDetailsPage.jsx', import.meta.url), 'utf8');
const share = fs.readFileSync(new URL('../src/components/ProductShareControls.jsx', import.meta.url), 'utf8');
const shareHelper = fs.readFileSync(new URL('../src/data/productShare.js', import.meta.url), 'utf8');

test('PDP carousel card order matches store policies', () => {
  const order = [
    "id: 'specs'",
    "id: 'product-details'",
    "id: 'delivery'",
    "id: 'exchange'",
    "id: 'cancellation'",
  ];
  let cursor = -1;
  for (const marker of order) {
    const next = carousel.indexOf(marker);
    assert.ok(next > cursor, `missing or out of order: ${marker}`);
    cursor = next;
  }
});

test('Arabic delivery / exchange / cancellation policies match old-store wording', () => {
  const ar = translations.ar.detail;
  assert.equal(ar.deliveryTitle, 'سياسة التوصيل');
  assert.deepEqual(ar.deliveryPoints, [
    'يتم التوصيل عادة خلال ثلاثة أيام عمل.',
    'توصيل الطلبات يتم من خلال شركات توصيل مرخصة في البلاد.',
    'يتم الاتصال بك من خلال مندوب التوصيل قبل أن يصل الى عنوانك.',
    'يتم دفع ثمن البضاعة إلى موظف التوصيل في حال اخترت وسيلة الدفع عند الاستلام.',
    'الطلبات الكبيرة قد يترتب عليها رسوم توصيل إضافية، نقوم بالتواصل معك و إخبارك بأي رسوم إضافية قبل ارسال طلبك.',
  ]);
  assert.equal(ar.exchangeTitle, 'سياسة التبديل');
  assert.deepEqual(ar.exchangePoints, [
    'يرفع طلب تبديل المنتجات خلال مدة لا تزيد عن 24 ساعة حيث ان هذه المدة كافية للتأكد والتحقق من المنتجات التي تم استلامها من قبلك.',
    'يجب عليك الاحتفاظ بفاتورة المنتجات التي ترغب بتبديلها، فلا يمكن تبديل أي طلب دون وجود الفاتورة.',
    'يترتب عليك تكاليف خدمة التوصيل عند تبديل طلبك.',
  ]);
  assert.equal(ar.cancellationTitle, 'سياسة الإلغاء');
  assert.deepEqual(ar.cancellationPoints, [
    'يمكنك إلغاء طلبك عن طريق التواصل معنا مباشرة من خلال قنوات الاتصال المتوفرة على المتجر.',
    'يمكن إلغاء الطلب فقط في حالة عدم تجهيزه وإرساله مع شركة التوصيل.',
    'لا يمكن إلغاء الطلب في حال تم إرساله إليك مع شركة التوصيل.',
  ]);
  assert.equal(ar.paymentTitle, 'الدفع عند الاستلام');
  assert.equal(ar.paymentBody, 'ببساطة نقوم بإيصال المنتج لغاية منزلك وتقوم بدفع الثمن لموظف التوصيل.');
});

test('English PDP policy titles and COD payment copy exist', () => {
  const en = translations.en.detail;
  assert.equal(en.specs, 'Details & Specs');
  assert.equal(en.productDetails, 'Product Details');
  assert.equal(en.deliveryTitle, 'Delivery Policy');
  assert.equal(en.exchangeTitle, 'Exchange Policy');
  assert.equal(en.cancellationTitle, 'Cancellation Policy');
  assert.equal(en.paymentTitle, 'Cash on delivery');
  assert.ok(en.deliveryPoints.length >= 5);
  assert.ok(en.exchangePoints.length >= 3);
  assert.ok(en.cancellationPoints.length >= 3);
});

test('PDP builds dynamic specs including sku hierarchy attributes and availability', () => {
  assert.match(page, /resolveAttributeLabels/);
  assert.match(page, /copy\.detail\.sku/);
  assert.match(page, /copy\.shop\.mainCategory/);
  assert.match(page, /copy\.shop\.subcategory/);
  assert.match(page, /copy\.detail\.age/);
  assert.match(page, /copy\.detail\.skill/);
  assert.match(page, /copy\.shop\.material/);
  assert.match(page, /copy\.shop\.productType/);
  assert.match(page, /copy\.category\.variants/);
  assert.match(page, /copy\.detail\.stock/);
  assert.match(page, /getProductAttributeIds/);
});

test('PDP keeps COD payment, copy link, and QR for current product URL', () => {
  assert.match(slide, /product-payment/);
  assert.match(slide, /copy\.detail\.paymentTitle/);
  assert.match(slide, /ProductShareControls/);
  assert.match(share, /copy\.detail\.copyLink/);
  assert.match(shareHelper, /api\.qrserver\.com/);
  const qr = buildQrImageUrl('https://example.com/ar/products/demo');
  assert.match(qr, /api\.qrserver\.com/);
  assert.match(qr, /demo/);
});
