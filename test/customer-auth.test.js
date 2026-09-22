import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getCustomerAuthConfig, isCustomerAuthConfigured, loginCustomer } from '../src/data/customerAuth.js';
import { translations } from '../src/i18n/translations.js';

const header = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const loginPage = fs.readFileSync(new URL('../src/pages/LoginPage.jsx', import.meta.url), 'utf8');
const accountPage = fs.readFileSync(new URL('../src/pages/AccountPage.jsx', import.meta.url), 'utf8');
const customerAuth = fs.readFileSync(new URL('../src/data/customerAuth.js', import.meta.url), 'utf8');

test('customer auth stays disabled without VITE_CUSTOMER_AUTH_API', () => {
  assert.equal(isCustomerAuthConfigured({}), false);
  assert.equal(getCustomerAuthConfig({}).enabled, false);
});

test('loginCustomer never invents a fake success session when auth is unconfigured', async () => {
  const result = await loginCustomer({ email: 'a@b.com', password: 'x' }, {});
  assert.equal(result.ok, false);
  assert.equal(result.code, 'AUTH_NOT_CONFIGURED');
});

test('header account actions navigate to login/account', () => {
  assert.match(header, /accountPath = isAuthenticated \? '\/account' : '\/login'/);
  assert.match(header, /onClick=\{goAccount\}/);
  assert.match(header, /localizePath\(accountPath, locale\)/);
});

test('app exposes localized login and account routes', () => {
  assert.match(app, /routePath === '\/login'/);
  assert.match(app, /routePath === '\/account'/);
  assert.match(app, /<LoginPage/);
  assert.match(app, /<AccountPage/);
  assert.match(app, /AuthProvider/);
});

test('login and account pages avoid hardcoded fake users', () => {
  assert.match(loginPage, /login\(\{ email, password \}\)/);
  assert.match(loginPage, /AUTH_NOT_CONFIGURED/);
  assert.doesNotMatch(loginPage, /password:\s*['"]admin|demo@|test@velvet/i);
  assert.match(accountPage, /navigate\(localizePath\('\/login', locale\)\)/);
  assert.match(customerAuth, /VITE_CUSTOMER_AUTH_API/);
  assert.match(customerAuth, /\/api\/customer\/auth\/login/);
});

test('login/account copy exists in EN and AR', () => {
  assert.equal(translations.en.login.title, 'Sign in');
  assert.equal(translations.ar.login.title, 'تسجيل الدخول');
  assert.ok(translations.en.account.title);
  assert.ok(translations.ar.account.title);
  assert.equal(translations.en.meta.login, 'Login');
  assert.equal(translations.ar.meta.login, 'تسجيل الدخول');
});
