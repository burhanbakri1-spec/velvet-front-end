import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeArabicSearch, normalizeForSearch, ARABIC_NORMALIZATION_RULES } from '../src/utils/arabicNormalize.js';

test('normalizeArabicSearch - hamza variants to bare alif', () => {
  assert.equal(normalizeArabicSearch('أ'), 'ا');
  assert.equal(normalizeArabicSearch('إ'), 'ا');
  assert.equal(normalizeArabicSearch('آ'), 'ا');
  assert.equal(normalizeArabicSearch('أطفال'), 'اطفال');
  assert.equal(normalizeArabicSearch('إِ'), 'ا');
});

test('normalizeArabicSearch - ta marbuta to ha', () => {
  // Ta marbuta (U+0629) converts to ha (U+0647)
  assert.equal(normalizeArabicSearch('\u0629'), '\u0647'); // ة -> ه
  
  // الهدية (with ta marbuta: ه د ي ة) -> ه د ي ه
  const hadiyaWithTaMarbuta = '\u0647\u062F\u064A\u0629'; // هدية with ة
  const hadiyaWithHa = '\u0647\u062F\u064A\u0647';       // هديه with ه
  assert.equal(normalizeArabicSearch(hadiyaWithTaMarbuta), hadiyaWithHa);
  assert.equal(normalizeArabicSearch(hadiyaWithHa), hadiyaWithHa);
  assert.equal(normalizeArabicSearch(hadiyaWithTaMarbuta), normalizeArabicSearch(hadiyaWithHa));
  
  // مدرسة (with ta marbuta) -> مدرسه
  const madrasaWithTaMarbuta = '\u0645\u062F\u0631\u0633\u0629'; // مدرسة with ة
  const madrasaWithHa = '\u0645\u062F\u0631\u0633\u0647';       // مدرسه with ه
  assert.equal(normalizeArabicSearch(madrasaWithTaMarbuta), madrasaWithHa);
  assert.equal(normalizeArabicSearch(madrasaWithHa), madrasaWithHa);
  assert.equal(normalizeArabicSearch(madrasaWithTaMarbuta), normalizeArabicSearch(madrasaWithHa));
});

test('normalizeArabicSearch - alif maqsura to ya', () => {
  assert.equal(normalizeArabicSearch('ى'), 'ي');
  assert.equal(normalizeArabicSearch('مصطفى'), 'مصطفي');
});

test('normalizeArabicSearch - removes diacritics and tatweel', () => {
  assert.equal(normalizeArabicSearch('أَطْفَال'), 'اطفال');
  assert.equal(normalizeArabicSearch('عـرَبـي'), 'عربي');
  assert.equal(normalizeArabicSearch('مُـدَرِّس'), 'مدرس');
});

test('normalizeArabicSearch - trims and collapses whitespace', () => {
  assert.equal(normalizeArabicSearch('  ألعاب   '), 'العاب');
  assert.equal(normalizeArabicSearch('ألعاب\t\t للأطفال'), 'العاب للاطفال');
});

test('normalizeArabicSearch - lowercases English letters', () => {
  assert.equal(normalizeArabicSearch('TOYS'), 'toys');
  assert.equal(normalizeArabicSearch('Toys For Kids'), 'toys for kids');
  assert.equal(normalizeArabicSearch('ألعاب TOYS'), 'العاب toys');
});

test('normalizeArabicSearch - preserves Arabic (no case change)', () => {
  assert.equal(normalizeArabicSearch('ألعاب'), 'العاب');
  assert.equal(normalizeArabicSearch('أطفال'), 'اطفال');
});

test('normalizeArabicSearch - examples from requirements', () => {
  assert.equal(normalizeArabicSearch('العاب'), normalizeArabicSearch('ألعاب'));
  assert.equal(normalizeArabicSearch('اطفال'), normalizeArabicSearch('أطفال'));
  assert.equal(normalizeArabicSearch('مدرسه'), normalizeArabicSearch('مدرسة'));
  assert.equal(normalizeArabicSearch('هديه'), normalizeArabicSearch('هدية'));
});

test('normalizeForSearch - alias works', () => {
  assert.equal(normalizeForSearch('ألعاب'), 'العاب');
});

test('ARABIC_NORMALIZATION_RULES exported for reference', () => {
  assert.ok(ARABIC_NORMALIZATION_RULES.hamza);
  assert.ok(ARABIC_NORMALIZATION_RULES.taMarbuta);
  assert.ok(ARABIC_NORMALIZATION_RULES.alifMaqsura);
  assert.ok(ARABIC_NORMALIZATION_RULES.diacritics);
});