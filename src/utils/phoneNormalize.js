/**
 * Phone normalization utilities for VELVET checkout.
 *
 * Uses libphonenumber-js for reliable international phone parsing.
 * Country selector uses ISO country codes as primary identity.
 * Palestine (PS) and Israel (IL) are pinned at the top for quick access.
 */

import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
} from 'libphonenumber-js/min';

/**
 * Re-export parsePhoneNumberFromString for external use (e.g., tests, selectors)
 */
export { parsePhoneNumberFromString };

/**
 * Build the country list from libphonenumber-js metadata.
 * Pins Palestine (PS) and Israel (IL) at the top.
 * Uses Intl.DisplayNames for localized country names.
 * Overrides pinned country names with friendly labels.
 */
function buildCountryList() {
  // Get all supported ISO country codes from libphonenumber-js
  const allCountryCodes = getCountries();

  // Create display name formatters
  const displayNamesEn = new Intl.DisplayNames(['en'], { type: 'region' });
  const displayNamesAr = new Intl.DisplayNames(['ar'], { type: 'region' });

  // Build country entries with calling codes
  const countries = allCountryCodes
    .map((countryCode) => {
      const callingCode = getCountryCallingCode(countryCode);
      if (!callingCode) return null;
      return {
        country: countryCode,
        code: `+${callingCode}`,
        name: displayNamesEn.of(countryCode) || countryCode,
        nameAr: displayNamesAr.of(countryCode) || countryCode,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Pin Palestine and Israel at the top with friendly names
  const pinnedCodes = ['PS', 'IL'];
  const pinned = pinnedCodes
    .map((code) => countries.find((c) => c.country === code))
    .filter(Boolean)
    .map((c) => {
      const nameEn = c.country === 'PS' ? 'Palestine' : 'Israel';
      const nameAr = c.country === 'PS' ? 'فلسطين' : 'إسرائيل';
      return { ...c, name: nameEn, nameAr, pinned: true };
    });

  // Remove pinned from main list
  const searchable = countries.filter((c) => !pinnedCodes.includes(c.country));

  return [...pinned, ...searchable];
}

/** Country list with ISO codes as primary identity, generated from libphonenumber-js */
export const COUNTRIES = buildCountryList();

/** Get the quick-access pinned countries (Palestine PS, Israel IL) */
export function getPinnedCountries() {
  return COUNTRIES.filter((c) => c.pinned);
}

/** Get the searchable international list (excluding pinned to avoid duplicates) */
export function getSearchableCountries() {
  return COUNTRIES.filter((c) => !c.pinned);
}

/** All countries combined (pinned first, then searchable) */
export function getAllCountries() {
  return [...getPinnedCountries(), ...getSearchableCountries()];
}

/** Get calling codes for backward compatibility */
export const SUPPORTED_COUNTRY_CODES = COUNTRIES.map((c) => c.code);

/** Default ISO country (Palestine) */
export const DEFAULT_COUNTRY = 'PS';

/** Default calling code (Palestine +970) */
export const DEFAULT_COUNTRY_CODE = '+970';

/**
 * Find country info by ISO country code.
 */
export function getCountryByISO(iso) {
  return COUNTRIES.find((c) => c.country === iso.toUpperCase());
}

/**
 * Find country info by calling code.
 * Note: Multiple countries may share a calling code.
 * Returns the first match (preferring pinned).
 */
export function getCountryByCode(code) {
  return COUNTRIES.find((c) => c.code === code);
}

/**
 * Get calling code for an ISO country.
 */
export function getCallingCode(iso) {
  const country = getCountryByISO(iso);
  return country?.code || DEFAULT_COUNTRY_CODE;
}

/**
 * Normalize a phone number input for a given ISO country.
 *
 * Uses libphonenumber-js for reliable parsing:
 * - Parses the input with the selected ISO country as default region
 * - If input starts with + and valid country code, libphonenumber-js auto-detects the country
 * - Uses parsed metadata whenever parsePhoneNumberFromString returns a phone object
 * - Does NOT fabricate canonical numbers from unparseable input
 *
 * @param {string} input - Raw phone number input (e.g. "0591111111", "591111111", "+970 59 111 1111", "+14155551234")
 * @param {string} isoCountry - ISO country code selector value (e.g. "PS", "IL", "US", "CA")
 * @returns {{
 *   phoneCountryCode: string,  // Calling code of the PARSED number (may differ from selector if +intl pasted)
 *   phoneISO: string,          // ISO country of the parsed number (may differ from selector if +intl pasted)
 *   phoneNational: string,     // National significant number (no trunk prefix)
 *   phoneCanonical: string,    // E.164 format (+CC + national) or '' if unparseable
 *   phoneLocal: string         // User's cleaned input preserving local conventions
 * }}
 */
export function normalizePhone(input, isoCountry) {
  const iso = String(isoCountry || DEFAULT_COUNTRY).trim().toUpperCase();
  const raw = String(input || '').trim();

  if (!raw) {
    const defaultCode = getCallingCode(iso);
    return {
      phoneCountryCode: defaultCode,
      phoneISO: iso,
      phoneNational: '',
      phoneCanonical: '',
      phoneLocal: '',
    };
  }

  // Parse with the selected ISO country as default region
  // libphonenumber-js handles + international format automatically
  let parsed;
  try {
    parsed = parsePhoneNumberFromString(raw, iso);
  } catch {
    parsed = null;
  }

  // If we got a parsed phone object (even if not fully valid), use its metadata
  // This handles numbers that are structurally possible but not classified as fully valid
  if (parsed) {
    const parsedISO = parsed.country || iso;
    const national = parsed.nationalNumber; // string without country code or trunk prefix
    const canonical = parsed.number || ''; // E.164 format (+CC + national) or '' if not available
    const callingCode = parsed.countryCallingCode ? `+${parsed.countryCallingCode}` : getCallingCode(parsedISO);

    // Get the user's input in a cleaned local format
    // Try to preserve the original formatting style
    let local = parsed.formatNational ? parsed.formatNational() : raw.replace(/[\s\-\(\)]/g, '');

    // If user entered without formatting, keep it simple
    const rawDigits = raw.replace(/[\s\-\(\)]/g, '');
    if (!raw.includes(' ') && !raw.includes('-') && !raw.includes('(')) {
      // User entered compact format - preserve that style
      if (raw.startsWith('+')) {
        local = rawDigits; // Keep as-entered for international format
      } else if (raw.startsWith('0')) {
        local = rawDigits; // Keep leading 0 as entered
      } else {
        // No leading 0, no + - assume national format
        local = rawDigits;
      }
    }

    return {
      phoneCountryCode: callingCode,
      phoneISO: parsedISO,
      phoneNational: national || '',
      phoneCanonical: canonical,
      phoneLocal: local,
    };
  }

  // Parsing completely failed - return safe incomplete structure
  // Do NOT fabricate canonical from unparseable input
  const defaultCode = getCallingCode(iso);
  // Strip all non-digits for the local fallback
  const cleaned = raw.replace(/\D/g, '');

  return {
    phoneCountryCode: defaultCode,
    phoneISO: iso,
    phoneNational: '',
    phoneCanonical: '',
    phoneLocal: cleaned || raw,
  };
}

/**
 * Check if a phone number is valid for the given ISO country.
 * Strict validation: requires libphonenumber-js to parse and isPossible() === true.
 * No permissive fallback.
 *
 * @param {string} nationalInput
 * @param {string} isoCountry
 * @returns {boolean}
 */
export function isValidPhone(nationalInput, isoCountry) {
  const iso = String(isoCountry || DEFAULT_COUNTRY).trim().toUpperCase();
  const raw = String(nationalInput || '').trim();

  if (!raw) return false;

  // Strict libphonenumber-js validation
  try {
    const parsed = parsePhoneNumberFromString(raw, iso);
    if (!parsed) return false;

    // Check E.164 length limit (max 15 digits)
    const canonical = parsed.number; // E.164 format
    const digitsOnly = canonical.replace(/^\+/, '');
    if (digitsOnly.length > 15) return false;

    // Require isPossible() === true (structural validity)
    if (!parsed.isPossible()) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize WhatsApp phone data.
 * Auto-syncs selector if user pastes an international number, same as primary phone.
 *
 * @param {string} input - Raw WhatsApp number input
 * @param {string} isoCountry - ISO country code selector value
 * @returns {{ whatsappCountryCode, whatsappISO, whatsappNational, whatsappCanonical, whatsappLocal }}
 */
export function normalizeWhatsApp(input, isoCountry) {
  const normalized = normalizePhone(input, isoCountry);
  return {
    whatsappCountryCode: normalized.phoneCountryCode,
    whatsappISO: normalized.phoneISO,
    whatsappNational: normalized.phoneNational,
    whatsappCanonical: normalized.phoneCanonical,
    whatsappLocal: normalized.phoneLocal,
  };
}

/**
 * Derive WhatsApp data from contact phone when "same as phone" is enabled.
 *
 * @param {Object} contactPhoneData - Result from normalizePhone
 * @returns {{ whatsappCountryCode, whatsappISO, whatsappNational, whatsappCanonical, whatsappLocal }}
 */
export function deriveWhatsAppFromContact(contactPhoneData) {
  return {
    whatsappCountryCode: contactPhoneData.phoneCountryCode,
    whatsappISO: contactPhoneData.phoneISO,
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

/**
 * Create empty WhatsApp payload (when WhatsApp is not provided)
 */
export function createEmptyWhatsAppPayload() {
  return {
    whatsappSameAsPhone: false,
    whatsappCountryCode: '',
    whatsappISO: '',
    whatsappNational: '',
    whatsappLocal: '',
    whatsappCanonical: '',
  };
}