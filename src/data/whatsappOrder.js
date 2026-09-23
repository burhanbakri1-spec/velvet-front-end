import { socialLinks } from './socialLinks.js';
import { formatPrice } from './currency.js';

const WHATSAPP_PHONE_FALLBACK = '970598431743';

/** Format money the same way as storefront UI (₪, 2 decimals). */
export function formatOrderPrice(value) {
  return formatPrice(value);
}

/** Prefer Arabic product name; fall back to the default name. */
export function resolveProductDisplayName(item) {
  const arabic = String(item?.nameAr ?? '').trim();
  if (arabic) return arabic;
  return String(item?.name ?? '').trim();
}

/** Official store WhatsApp digits from socialLinks (no leading +). */
export function getOfficialWhatsAppPhone(whatsappUrl = socialLinks.whatsapp) {
  const match = String(whatsappUrl || '').match(/[?&]phone=(\d+)/);
  return match?.[1] || WHATSAPP_PHONE_FALLBACK;
}

/** Recognized English option labels → Arabic for WhatsApp order text. */
const OPTION_LABEL_AR = Object.freeze({
  color: 'اللون',
  size: 'المقاس',
  material: 'الخامة',
  style: 'النمط',
  age: 'العمر',
  type: 'النوع',
});

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

/** Map known option labels to Arabic; unknown labels stay as-is. */
export function localizeOptionLabel(label) {
  const raw = String(label ?? '').trim();
  if (!raw) return '';
  if (ARABIC_SCRIPT.test(raw)) return raw;
  return OPTION_LABEL_AR[raw.toLowerCase()] || raw;
}

/**
 * Prefer an already-Arabic option value when present; otherwise keep the selected value.
 * Does not invent translations for English catalog values.
 */
export function resolveOptionValue(value, arabicValue) {
  const preferred = String(arabicValue ?? '').trim();
  if (preferred && ARABIC_SCRIPT.test(preferred)) return preferred;
  const selected = String(value ?? '').trim();
  if (selected && ARABIC_SCRIPT.test(selected)) return selected;
  return selected;
}

function formatSelections(selections) {
  const entries = Object.entries(selections || {}).filter(([, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return String(value.labelAr ?? value.label ?? value.value ?? '').trim() !== '';
    }
    return String(value ?? '').trim() !== '';
  });
  if (entries.length === 0) return '';
  return entries.map(([name, value]) => {
    const label = localizeOptionLabel(name);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const display = resolveOptionValue(value.label ?? value.value, value.labelAr);
      return `${label}: ${display}`;
    }
    return `${label}: ${resolveOptionValue(value)}`;
  }).join('، ');
}

function formatLineItem(item, index) {
  const name = resolveProductDisplayName(item) || 'منتج';
  const quantity = Number(item?.quantity) || 0;
  const unitPrice = Number(item?.price) || 0;
  const lineTotal = unitPrice * quantity;
  const options = formatSelections(item?.selections);
  const lines = [
    `${index}. ${name}`,
    `الكمية: ${quantity}`,
    `السعر: ${formatOrderPrice(unitPrice)}`,
  ];
  if (options) lines.push(`الخيارات: ${options}`);
  lines.push(`الإجمالي: ${formatOrderPrice(lineTotal)}`);
  return lines.join('\n');
}

/**
 * Build the complete Arabic WhatsApp order message.
 * Message language is always Arabic regardless of storefront locale.
 * When a real order was created first, orderNumber + status are included.
 */
export function buildWhatsAppOrderMessage({ customer = {}, items = [], subtotal = 0, shippingLabel = 'مجاني', orderNumber = '', status = '' } = {}) {
  const name = String(customer.name ?? '').trim();
  const phone = String(customer.phone ?? '').trim();
  const email = String(customer.email ?? '').trim();
  const city = String(customer.city ?? '').trim();
  const address = String(customer.address ?? '').trim();
  const notes = String(customer.notes ?? '').trim();
  const safeSubtotal = Number(subtotal);
  const total = Number.isFinite(safeSubtotal) ? safeSubtotal : 0;
  const lineItems = (Array.isArray(items) ? items : []).map((item, index) => formatLineItem(item, index + 1));

  const sections = [
    'طلب جديد من متجر VELVET',
    '',
    ...(String(orderNumber).trim() ? [`رقم الطلب: ${String(orderNumber).trim()}`] : []),
    `حالة الطلب: ${String(status).trim() || 'جديد'}`,
    '',
    'بيانات العميل:',
    `الاسم: ${name}`,
    `رقم الهاتف: ${phone}`,
    `البريد الإلكتروني: ${email}`,
    `المدينة: ${city}`,
    `العنوان: ${address}`,
    '',
    'تفاصيل الطلب:',
    '',
    lineItems.join('\n\n'),
    '',
    `المجموع الفرعي: ${formatOrderPrice(total)}`,
    `التوصيل: ${shippingLabel || 'مجاني'}`,
    `الإجمالي النهائي: ${formatOrderPrice(total)}`,
  ];

  if (notes) {
    sections.push('', 'ملاحظات العميل:', notes);
  }

  return sections.join('\n').trim();
}

/** Build the official WhatsApp deep link with a prefilled Arabic order message. */
export function buildWhatsAppOrderUrl(message, whatsappUrl = socialLinks.whatsapp) {
  const phone = getOfficialWhatsAppPhone(whatsappUrl);
  const text = encodeURIComponent(String(message ?? ''));
  return `https://api.whatsapp.com/send/?phone=${phone}&text=${text}&type=phone_number&app_absent=0`;
}

/** Open WhatsApp with the prepared message. Returns whether a new browsing context was opened. */
export function openWhatsAppOrder(url, openFn = typeof window !== 'undefined' ? window.open.bind(window) : null) {
  if (typeof openFn !== 'function' || !url) return false;
  const opened = openFn(url, '_blank', 'noopener,noreferrer');
  return Boolean(opened);
}
