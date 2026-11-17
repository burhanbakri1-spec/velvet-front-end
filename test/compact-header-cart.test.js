import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const header = fs.readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const cart = fs.readFileSync(new URL('../src/context/CartContext.jsx', import.meta.url), 'utf8');

test('compact mobile header pairs existing search with the real cart drawer action', () => {
  assert.match(header, /<div className="compact-header-actions">[\s\S]*?mobile-header-search-trigger[\s\S]*?compact-header-cart/);
  assert.match(header, /className="compact-header-cart header-cart-link"[\s\S]*?onClick=\{\(\) => setCartOpen\(true\)\}/);
  assert.match(header, /<CartDrawer open=\{cartOpen\} onClose=\{\(\) => setCartOpen\(false\)\} \/>/);
  assert.match(header, /className="header-cart-count"/);
  assert.match(header, /itemCount > 0 &&/);
  assert.match(header, /aria-label=\{`\$\{copy\.header\.cart\}: \$\{itemCount\}`\}/);
});

test('cart count remains sourced from the persistent shared cart context', () => {
  assert.match(header, /const \{ itemCount \} = useCart\(\)/);
  assert.match(cart, /const STORAGE_KEY = 'play-store-cart-v1'/);
  assert.match(cart, /const itemCount = items\.reduce\(\(sum, item\) => sum \+ item\.quantity, 0\)/);
});

test('compact search and cart share a fixed-height capsule with focus and RTL badge support', () => {
  assert.match(styles, /\.compact-header-actions \{ display: contents; \}/);
  assert.match(styles, /\.site-header\.is-compact \.compact-header-actions \{[\s\S]*?width: 92px;[\s\S]*?height: 44px;[\s\S]*?border-radius: 999px;/);
  assert.match(styles, /\.site-header\.is-compact \.compact-header-actions \.mobile-header-search-trigger,[\s\S]*?flex: 0 0 43px/);
  assert.match(styles, /html\[dir="rtl"\] \.site-header\.is-compact \.compact-header-cart \.header-cart-count/);
  assert.match(styles, /\.site-header\.is-compact \.compact-header-actions button:focus-visible/);
});
