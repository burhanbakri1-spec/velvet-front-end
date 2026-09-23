import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { normalizeFavoriteIds } from '../src/data/favorites.js';
import { buildOrderPayload } from '../src/data/orders.js';
import { filterApprovedReviews } from '../src/data/reviews.js';

const favoritesSource = fs.readFileSync(new URL('../src/data/favorites.js', import.meta.url), 'utf8');
const ordersSource = fs.readFileSync(new URL('../src/data/orders.js', import.meta.url), 'utf8');
const reviewsSource = fs.readFileSync(new URL('../src/data/reviews.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const registerPage = fs.readFileSync(new URL('../src/pages/RegisterPage.jsx', import.meta.url), 'utf8');

test('favorites helpers hit the verified /api/favorites contract', () => {
  assert.match(favoritesSource, /storefrontFetch\('\/api\/favorites'/);
  assert.match(favoritesSource, /storefrontFetch\(`\/api\/favorites\/\$\{encodeURIComponent\(productId\)\}`, \{\s*method: 'POST'/);
  assert.match(favoritesSource, /storefrontFetch\(`\/api\/favorites\/\$\{encodeURIComponent\(productId\)\}`, \{\s*method: 'DELETE'/);
});

test('normalizeFavoriteIds maps payload productIds into a Set of strings', () => {
  assert.deepEqual(
    [...normalizeFavoriteIds({ productIds: ['p1', 2, 'p3'] })],
    ['p1', '2', 'p3'],
  );
  assert.equal(normalizeFavoriteIds({}).size, 0);
  assert.equal(normalizeFavoriteIds({ products: [{ id: 'x' }] }).size, 0);
});

test('buildOrderPayload shapes the exact POST /api/orders body', () => {
  const payload = buildOrderPayload({
    customer: {
      name: '  Sara Ahmad  ',
      phone: '0598123456',
      email: ' sara@example.com ',
      city: 'Ramallah',
      address: 'Main St 3',
      notes: '  ',
    },
    items: [
      { productId: 'p1', variantId: 'v1', quantity: 2 },
      { productId: 'p2', quantity: 0 },
      { productId: '', variantId: 'v9', quantity: 1 },
    ],
  });
  assert.deepEqual(payload.customer, {
    name: 'Sara Ahmad',
    phone: '0598123456',
    email: 'sara@example.com',
    city: 'Ramallah',
    address: 'Main St 3',
    notes: undefined,
  });
  assert.deepEqual(payload.items, [
    { productId: 'p1', variantId: 'v1', quantity: 2 },
    { productId: 'p2', variantId: undefined, quantity: 1 },
  ]);
});

test('buildOrderPayload tolerates empty input', () => {
  assert.deepEqual(buildOrderPayload(), {
    customer: { name: '', phone: '', email: undefined, city: '', address: '', notes: undefined },
    items: [],
  });
});

test('orders module posts to /api/orders and lists via /api/orders/my-orders', () => {
  assert.match(ordersSource, /storefrontFetch\('\/api\/orders', \{ method: 'POST'/);
  assert.match(ordersSource, /storefrontFetch\('\/api\/orders\/my-orders'/);
  assert.doesNotMatch(ordersSource, /storefrontFetch\('\/api\/orders', \{ token \}\)/);
  assert.doesNotMatch(ordersSource, /limited: response\.status === 403/);
});

test('reviews module documents missing my-reviews API and isolates optimistic pending', () => {
  assert.match(reviewsSource, /MISSING API CONTRACT/);
  assert.match(reviewsSource, /persistOptimisticPendingReview/);
  assert.match(reviewsSource, /getOptimisticPendingReviews/);
  assert.match(reviewsSource, /OPTIMISTIC_PENDING_KEY|velvet-optimistic-pending-reviews/);
});

test('account orders tab uses my-orders as source of truth', () => {
  const accountPage = fs.readFileSync(new URL('../src/pages/AccountPage.jsx', import.meta.url), 'utf8');
  assert.match(accountPage, /fetchMyOrders\(token\)/);
  assert.doesNotMatch(accountPage, /getOrderSnapshots/);
  assert.match(accountPage, /ordersLoading/);
  assert.match(accountPage, /ordersError/);
});
test('filterApprovedReviews keeps only approved reviews', () => {
  const reviews = [
    { id: 'a', status: 'approved' },
    { id: 'b', status: 'pending' },
    { id: 'c', approved: true },
    { id: 'd', approved: false },
    { id: 'e' },
    null,
    'junk',
  ];
  const kept = filterApprovedReviews(reviews).map((item) => item.id);
  assert.deepEqual(kept, ['a', 'c', 'e']);
  assert.deepEqual(filterApprovedReviews(null), []);
  assert.deepEqual(filterApprovedReviews([]), []);
});

test('reviews module uses the verified /api/reviews contract', () => {
  assert.match(reviewsSource, /storefrontFetch\('\/api\/reviews\?scope=store'/);
  assert.match(reviewsSource, /storefrontFetch\(\s*`\/api\/reviews\?scope=product&productId=/);
  assert.match(reviewsSource, /storefrontFetch\('\/api\/reviews', \{ method: 'POST'/);
});

test('register route is wired in App and renders RegisterPage', () => {
  assert.match(app, /import RegisterPage from '\.\/pages\/RegisterPage'/);
  assert.match(app, /routePath === '\/register'/);
  assert.match(app, /<RegisterPage \/>/);
  assert.match(app, /'\/register'/);
  assert.match(registerPage, /register\(\{/);
  assert.match(registerPage, /passwordMismatch/);
  assert.match(registerPage, /AUTH_NOT_CONFIGURED/);
});