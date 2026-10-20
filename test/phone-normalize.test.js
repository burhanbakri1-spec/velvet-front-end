import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUPPORTED_COUNTRY_CODES,
  DEFAULT_COUNTRY_CODE,
  normalizePhone,
  normalizeWhatsApp,
  deriveWhatsAppFromContact,
  getPreferredWhatsAppCanonical,
  isValidPhone,
} from '../src/utils/phoneNormalize.js';

test('SUPPORTED_COUNTRY_CODES includes +970 and +972', () => {
  assert.deepEqual(SUPPORTED_COUNTRY_CODES, ['+970', '+972']);
});

test('DEFAULT_COUNTRY_CODE is +970', () => {
  assert.equal(DEFAULT_COUNTRY_CODE, '+970');
});

test('normalizePhone: +970 Palestinian with leading 0', () => {
  const result = normalizePhone('0591111111', '+970');
  assert.equal(result.phoneCountryCode, '+970');
  assert.equal(result.phoneNational, '591111111');
  assert.equal(result.phoneCanonical, '+970591111111');
  assert.equal(result.phoneLocal, '0591111111');
});

test('normalizePhone: +970 Palestinian without leading 0', () => {
  const result = normalizePhone('591111111', '+970');
  assert.equal(result.phoneCountryCode, '+970');
  assert.equal(result.phoneNational, '591111111');
  assert.equal(result.phoneCanonical, '+970591111111');
  assert.equal(result.phoneLocal, '0591111111');
});

test('normalizePhone: +972 Israeli with leading 0', () => {
  const result = normalizePhone('0521111111', '+972');
  assert.equal(result.phoneCountryCode, '+972');
  assert.equal(result.phoneNational, '521111111');
  assert.equal(result.phoneCanonical, '+972521111111');
  assert.equal(result.phoneLocal, '0521111111');
});

test('normalizePhone: +972 Israeli without leading 0', () => {
  const result = normalizePhone('521111111', '+972');
  assert.equal(result.phoneCountryCode, '+972');
  assert.equal(result.phoneNational, '521111111');
  assert.equal(result.phoneCanonical, '+972521111111');
  assert.equal(result.phoneLocal, '0521111111');
});

test('normalizePhone: removes only ONE leading 0', () => {
  const result = normalizePhone('00591111111', '+970');
  // Only first 0 removed, second 0 kept as part of national number
  assert.equal(result.phoneNational, '0591111111');
  assert.equal(result.phoneCanonical, '+9700591111111');
});

test('normalizePhone: strips formatting characters', () => {
  const result = normalizePhone('059-111-1111', '+970');
  assert.equal(result.phoneNational, '591111111');
  assert.equal(result.phoneCanonical, '+970591111111');
});

test('normalizePhone: strips spaces and parentheses', () => {
  const result = normalizePhone('(059) 111 1111', '+970');
  assert.equal(result.phoneNational, '591111111');
  assert.equal(result.phoneCanonical, '+970591111111');
});

test('normalizeWhatsApp: same as normalizePhone but with whatsapp prefix', () => {
  const result = normalizeWhatsApp('0591111111', '+970');
  assert.equal(result.whatsappCountryCode, '+970');
  assert.equal(result.whatsappNational, '591111111');
  assert.equal(result.whatsappCanonical, '+970591111111');
  assert.equal(result.whatsappLocal, '0591111111');
});

test('deriveWhatsAppFromContact: copies contact phone data', () => {
  const contactData = {
    phoneCountryCode: '+970',
    phoneNational: '591111111',
    phoneCanonical: '+970591111111',
    phoneLocal: '0591111111',
  };
  const result = deriveWhatsAppFromContact(contactData);
  assert.equal(result.whatsappCountryCode, '+970');
  assert.equal(result.whatsappNational, '591111111');
  assert.equal(result.whatsappCanonical, '+970591111111');
  assert.equal(result.whatsappLocal, '0591111111');
});

test('getPreferredWhatsAppCanonical: uses whatsappCanonical when available', () => {
  const data = {
    whatsappCanonical: '+972521234567',
    whatsappNational: '521234567',
    phoneCanonical: '+970591111111',
    phoneNational: '591111111',
  };
  const result = getPreferredWhatsAppCanonical(data);
  assert.equal(result, '972521234567'); // without leading +
});

test('getPreferredWhatsAppCanonical: falls back to phoneCanonical', () => {
  const data = {
    whatsappCanonical: '',
    whatsappNational: '',
    phoneCanonical: '+970591111111',
    phoneNational: '591111111',
  };
  const result = getPreferredWhatsAppCanonical(data);
  assert.equal(result, '970591111111');
});

test('getPreferredWhatsAppCanonical: returns empty string when both missing', () => {
  const data = {
    whatsappCanonical: '',
    whatsappNational: '',
    phoneCanonical: '',
    phoneNational: '',
  };
  const result = getPreferredWhatsAppCanonical(data);
  assert.equal(result, '');
});

test('isValidPhone: validates Palestinian number length', () => {
  assert.equal(isValidPhone('591111111', '+970'), true); // 9 digits
  assert.equal(isValidPhone('59111111', '+970'), true); // 8 digits
  assert.equal(isValidPhone('5911111111', '+970'), true); // 10 digits
  assert.equal(isValidPhone('5911111', '+970'), false); // 7 digits - too short
  assert.equal(isValidPhone('59111111111', '+970'), false); // 11 digits - too long
});

test('isValidPhone: validates Israeli number length', () => {
  assert.equal(isValidPhone('521111111', '+972'), true);
  assert.equal(isValidPhone('52111111', '+972'), true);
  assert.equal(isValidPhone('5211111111', '+972'), true);
  assert.equal(isValidPhone('5211111', '+972'), false);
  assert.equal(isValidPhone('52111111111', '+972'), false);
});

test('isValidPhone: handles input with leading 0', () => {
  assert.equal(isValidPhone('0591111111', '+970'), true);
  assert.equal(isValidPhone('0521111111', '+972'), true);
});