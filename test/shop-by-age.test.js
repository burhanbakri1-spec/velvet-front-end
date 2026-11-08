import assert from 'node:assert/strict';
import test from 'node:test';
import { CANONICAL_AGE_IDS, formatCanonicalAgeRange, getCanonicalAgeGroups, selectAgeBrowseProducts } from '../src/data/ageBrowse.js';
import { resetFilterDefinitionsForTests } from '../src/data/velvetCatalog.js';
import { applyPlatformContent } from '../src/data/platformContent.js';
import { orderShopCatalog } from '../src/data/displayPriority.js';

const age = (id) => ({ id, label: { en: id, ar: id } });
const product = (id, ageIds, extra = {}) => ({
  id,
  slug: id,
  brandId: extra.brandId || 'brand-a',
  ageIds,
  active: true,
  visible: true,
  published: true,
  available: true,
  status: 'active',
  ...extra,
});

test.beforeEach(() => resetFilterDefinitionsForTests());

test('age card range labels are presentation of the four canonical ids only', () => {
  assert.deepEqual(CANONICAL_AGE_IDS.map(formatCanonicalAgeRange), ['0–3', '3–6', '6–10', '10+']);
  assert.equal(formatCanonicalAgeRange('5-7y'), '');
});

test('canonical age cards use API definitions and the exact four age ids', () => {
  applyPlatformContent({
    site: { id: 'site', companyId: 'company' },
    brands: [], categories: [], products: [],
    filterDefinitions: { age: CANONICAL_AGE_IDS.map(age) },
  }, 'https://api.test');
  const groups = getCanonicalAgeGroups();
  assert.deepEqual(groups.map((group) => group.id), CANONICAL_AGE_IDS);
  assert.equal(groups[1].name.en, '3-6y');
});

test('age browse includes exact age membership across brands and supports multiple age tags', () => {
  const source = [
    product('collect-young', ['0-3y'], { brandId: 'collect' }),
    product('move-multi', ['3-6y', '6-10y'], { brandId: 'move' }),
    product('collect-other', ['10+y'], { brandId: 'collect' }),
  ];
  assert.deepEqual(selectAgeBrowseProducts(source, '3-6y').map((item) => item.id), ['move-multi']);
  assert.deepEqual(selectAgeBrowseProducts(source, '6-10y').map((item) => item.id), ['move-multi']);
  assert.deepEqual(selectAgeBrowseProducts(source, '0-3y').map((item) => item.id), ['collect-young']);
  assert.deepEqual(selectAgeBrowseProducts(source, '10+y').map((item) => item.id), ['collect-other']);
});

test('untagged, unrecognized and invalid age selections do not classify products', () => {
  const source = [product('untagged', []), product('other-tag', ['5-6y'])];
  assert.deepEqual(selectAgeBrowseProducts(source, '0-3y'), []);
  assert.deepEqual(selectAgeBrowseProducts(source, 'not-a-canonical-age'), []);
});

test('hidden, pending-review, identity-pending, inactive and unavailable products stay out', () => {
  const source = [
    product('good', ['3-6y']),
    product('inactive', ['3-6y'], { active: false }),
    product('hidden', ['3-6y'], { visible: false }),
    product('unpublished', ['3-6y'], { published: false }),
    product('unavailable', ['3-6y'], { available: false }),
    product('draft', ['3-6y'], { status: 'draft' }),
    product('pending-review', ['3-6y'], { status: 'pending_review' }),
    product('identity-pending', ['3-6y'], { status: 'identity_pending' }),
  ];
  assert.deepEqual(selectAgeBrowseProducts(source, '3-6y').map((item) => item.id), ['good']);
});

test('duplicate product identities are rendered once without changing source order', () => {
  const source = [product('first', ['6-10y']), product('second', ['6-10y']), product('first', ['6-10y'])];
  assert.deepEqual(selectAgeBrowseProducts(source, '6-10y').map((item) => item.id), ['first', 'second']);
});

test('existing display priority reorders only the eligible age results', () => {
  const eligible = selectAgeBrowseProducts([
    product('first', ['10+y']), product('featured', ['10+y']), product('other-age', ['3-6y']),
  ], '10+y');
  assert.deepEqual(orderShopCatalog(eligible, ['featured']).map((item) => item.id), ['featured', 'first']);
});
