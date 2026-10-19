/**
 * Arabic search normalization helper.
 *
 * Normalizes Arabic text for search matching by:
 * - Converting hamza variants (أ / إ / آ) to bare alif (ا)
 * - Converting ta marbuta (ة) to ha (ه)
 * - Converting alif maqsura (ى) to ya (ي)
 * - Removing Arabic diacritics (tashkeel)
 * - Removing tatweel (ـ)
 * - Trimming and collapsing repeated whitespace
 * - Lowercasing English letters (Arabic has no case)
 *
 * Does NOT alter displayed product names — only used for search matching.
 */

// Arabic diacritics (tashkeel) and tatweel
const DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u0640]/g;

// Hamza variants to bare alif
const HAMZA_REGEX = /[\u0623\u0625\u0622]/g; // أ إ آ -> ا

// Ta marbuta to ha
const TA_MARBUTA_REGEX = /\u0629/g; // ة -> ه

// Alif maqsura to ya
const ALIF_MAQSURA_REGEX = /\u0649/g; // ى -> ي

// Whitespace collapse
const WHITESPACE_REGEX = /\s+/g;

export function normalizeArabicSearch(text) {
  if (!text) return '';
  return String(text)
    // Normalize hamza variants
    .replace(HAMZA_REGEX, '\u0627') // ا
    // Normalize ta marbuta
    .replace(TA_MARBUTA_REGEX, '\u0647') // ه
    // Normalize alif maqsura
    .replace(ALIF_MAQSURA_REGEX, '\u064A') // ي
    // Remove diacritics and tatweel
    .replace(DIACRITICS_REGEX, '')
    // Lowercase English letters (Arabic unaffected)
    .toLowerCase()
    // Trim and collapse whitespace
    .trim()
    .replace(WHITESPACE_REGEX, ' ');
}

export function normalizeForSearch(text) {
  return normalizeArabicSearch(text);
}

// Export regex patterns for testing if needed
export const ARABIC_NORMALIZATION_RULES = {
  hamza: { from: '[\u0623\u0625\u0622]', to: '\u0627', description: 'أ/إ/آ -> ا' },
  taMarbuta: { from: '\u0629', to: '\u0647', description: 'ة -> ه' },
  alifMaqsura: { from: '\u0649', to: '\u064A', description: 'ى -> ي' },
  diacritics: { from: '[\u064B-\u065F\u0670\u0640]', to: '', description: 'Remove tashkeel and tatweel' },
};