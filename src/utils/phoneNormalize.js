/**
 * Phone normalization utilities for VELVET checkout.
 *
 * Supports Palestine (+970) and Israel (+972) country codes.
 * Handles local trunk prefix (0) normalization for canonical international format.
 */

/** Supported country codes for the checkout phone selector. */
export const SUPPORTED_COUNTRY_CODES = ['+970', '+972'];

/** Default country code (Palestine). */
export const DEFAULT_COUNTRY_CODE = '+970';

/**
 * Normalize a phone number input for a given country code.
 *
 * Rules:
 * - Remove only ONE leading local trunk prefix '0' when deriving canonical form
 * - Preserve the local representation (with leading 0) in phoneLocal
 * - Accept input with or without leading 0
 * - Strip formatting characters (spaces, dashes, parentheses)
 * - Return structured phone data for API payload
 *
 * @param {string} input - Raw phone number input (national format, e.g. "0591111111" or "591111111")
 * @param {string} countryCode - Country code selector value ("+970" or "+972")
 * @returns {{
 *   phoneCountryCode: string,
 *   phoneNational: string,
 *   phoneCanonical: string,
 *   phoneLocal: string
 * }}
 */
export function normalizePhone(input, countryCode) {
  const code = String(countryCode || DEFAULT_COUNTRY_CODE).trim();
  const raw = String(input || '').trim();

  // Strip formatting characters but keep digits only
  const digitsOnly = raw.replace(/[\s\-\(\)]/g, '');

  // Remove exactly ONE leading '0' if present (local trunk prefix)
  const national = digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly;

  // Build canonical: countryCode + national (no leading 0)
  const canonical = `${code}${national}`;

  // Build local: with leading 0 (for display/UI)
  const local = `0${national}`;

  return {
    phoneCountryCode: code,
    phoneNational: national,
    phoneCanonical: canonical,
    phoneLocal: local,
  };
}

/**
 * Normalize phone input from the form's phone field (which stores the national number).
 * This is used when the form stores the national number (without country code).
 *
 * @param {string} nationalInput - The national number from the phone input field
 * @param {string} countryCode - The selected country code
 * @returns {{ phoneCountryCode, phoneNational, phoneCanonical, phoneLocal }}
 */
export function normalizePhoneFromNational(nationalInput, countryCode) {
  return normalizePhone(nationalInput, countryCode);
}

/**
 * Check if a phone number is valid for the given country code.
 * Basic validation: must have digits after normalization, reasonable length.
 *
 * @param {string} nationalInput
 * @param {string} countryCode
 * @returns {boolean}
 */
export function isValidPhone(nationalInput, countryCode) {
  const normalized = normalizePhone(nationalInput, countryCode);
  // Palestine/Israel mobile numbers are typically 9 digits after country code
  // (e.g., 591111111 = 9 digits). Accept 8-10 digits for flexibility.
  return normalized.phoneNational.length >= 8 && normalized.phoneNational.length <= 10;
}

/**
 * Normalize WhatsApp phone data.
 * Same logic as normalizePhone but for the optional WhatsApp field.
 *
 * @param {string} input - Raw WhatsApp number input
 * @param {string} countryCode - Country code selector value
 * @returns {{ whatsappCountryCode, whatsappNational, whatsappCanonical, whatsappLocal }}
 */
export function normalizeWhatsApp(input, countryCode) {
  const normalized = normalizePhone(input, countryCode);
  return {
    whatsappCountryCode: normalized.phoneCountryCode,
    whatsappNational: normalized.phoneNational,
    whatsappCanonical: normalized.phoneCanonical,
    whatsappLocal: normalized.phoneLocal,
  };
}

/**
 * Derive WhatsApp data from contact phone when "same as phone" is enabled.
 *
 * @param {Object} contactPhoneData - Result from normalizePhone
 * @returns {{ whatsappCountryCode, whatsappNational, whatsappCanonical, whatsappLocal }}
 */
export function deriveWhatsAppFromContact(contactPhoneData) {
  return {
    whatsappCountryCode: contactPhoneData.phoneCountryCode,
    whatsappNational: contactPhoneData.phoneNational,
    whatsappCanonical: contactPhoneData.phoneCanonical,
    whatsappLocal: contactPhoneData.phoneLocal,
  };
}

/**
 * Get the preferred WhatsApp canonical number for WhatsApp actions.
 * Uses whatsappCanonical if provided and valid, otherwise falls back to phoneCanonical.
 *
 * @param {Object} data - Form data containing phone and whatsapp fields
 * @returns {string} Canonical number without leading + (for WhatsApp URL)
 */
export function getPreferredWhatsAppCanonical(data) {
  // Use whatsappCanonical if explicitly provided and has national digits
  if (data.whatsappCanonical && data.whatsappNational && data.whatsappNational.length > 0) {
    // Return without leading + for WhatsApp URL
    return data.whatsappCanonical.replace(/^\+/, '');
  }
  // Fallback to phoneCanonical
  if (data.phoneCanonical && data.phoneNational && data.phoneNational.length > 0) {
    return data.phoneCanonical.replace(/^\+/, '');
  }
  // Ultimate fallback (should not happen in practice)
  return '';
}