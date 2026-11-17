import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const evidencePath = path.resolve('test-results/brand-category-cart-evidence');
const viewports = [320, 360, 375, 390, 412, 430, 768];

test('brand main-category deck and compact cart work in Arabic, English, mobile, and desktop', async ({ browser }) => {
  test.setTimeout(90_000);
  fs.mkdirSync(evidencePath, { recursive: true });
  const failures = [];
  const layoutEvidence = [];

  for (const locale of ['en', 'ar']) {
    for (const width of viewports) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        isMobile: width <= 430,
        hasTouch: width <= 768,
        deviceScaleFactor: 1,
      });
      await context.addInitScript((language) => {
        localStorage.setItem('play-language', language);
        localStorage.setItem('play-store-cart-v1', JSON.stringify([{
          key: 'e2e-item', productId: 'e2e-item', slug: 'e2e-item', name: 'Cart check', nameAr: 'اختبار السلة',
          image: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', price: 10, selections: {}, quantity: 2, variantId: '', maxStock: null,
        }]));
      }, locale);
      const page = await context.newPage();
      page.on('pageerror', (error) => failures.push(`${locale}-${width}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') failures.push(`${locale}-${width} console: ${message.text()}`); });
      page.on('requestfailed', (request) => failures.push(`${locale}-${width} request failed: ${request.url()} ${request.failure()?.errorText || ''}`));
      await page.goto(`/${locale}/brands/baby`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#showcases .home-brand .brand-showcase');
      const cards = page.locator('#showcases .home-brand');
      const count = await cards.count();
      expect(count, `${locale} ${width}px should show the brand's main-category banners`).toBeGreaterThan(0);

      await page.evaluate(() => window.scrollTo({ top: 220, behavior: 'instant' }));
      await expect(page.locator('.site-header')).toHaveClass(/is-compact/);
      const compact = page.locator('.compact-header-actions');
      await expect(compact).toBeVisible();
      await expect(compact.locator('.mobile-header-search-trigger')).toHaveAttribute('aria-label', /Search|بحث/i);
      await expect(compact.locator('.compact-header-cart')).toHaveAttribute('aria-label', /2/);
      await expect(compact.locator('.header-cart-count')).toHaveText('2');
      const geometry = await page.evaluate(() => {
        const logo = document.querySelector('.site-header .logo');
        const header = document.querySelector('.site-header');
        const capsule = document.querySelector('.compact-header-actions');
        const menu = document.querySelector('.menu-toggle');
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          headerHeight: header?.getBoundingClientRect().height,
          logo: logo?.getBoundingClientRect().toJSON(),
          capsule: capsule?.getBoundingClientRect().toJSON(),
          menu: menu?.getBoundingClientRect().toJSON(),
          direction: getComputedStyle(document.documentElement).direction,
          cards: document.querySelectorAll('#showcases .home-brand').length,
        };
      });
      expect(geometry.overflow, `${locale} ${width}px has no horizontal page overflow`).toBe(false);
      expect(geometry.logo.width).toBeGreaterThan(0);
      expect(geometry.capsule.width).toBe(92);
      expect(geometry.menu.width).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: path.join(evidencePath, `${locale}-${width}-compact.png`), fullPage: false });

      await compact.locator('.compact-header-cart').click();
      await expect(page.locator('.cart-drawer.is-open')).toBeVisible();
      await page.locator('.cart-drawer__controls button').nth(1).click();
      await expect(compact.locator('.header-cart-count')).toHaveText('3');
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('play-store-cart-v1'))?.[0]?.quantity)).toBe(3);
      await page.locator('.cart-drawer__close').click();

      const stageMetrics = await page.evaluate(async () => {
        const root = document.querySelector('#showcases');
        const shell = root?.querySelector('.hero-stage-shell');
        const stage = root?.querySelector('.hero-stage');
        const offset = shell ? shell.getBoundingClientRect().top + scrollY : 0;
        const headerOffset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
        const firstSection = stage?.querySelector(':scope > .home-brand');
        const firstHero = firstSection?.querySelector('.brand-showcase');
        const firstStrip = firstSection?.querySelector('.brand-strip');
        const firstBoundary = offset - headerOffset + (firstHero?.offsetHeight || 0) + (firstStrip?.offsetHeight || 0);
        const localSpan = Math.max(0, (shell?.scrollHeight || 0) - (stage?.clientHeight || 0));
        const checkpoints = [0, .28, .55, .82, 1].map((ratio) => offset + localSpan * ratio);
        const snapshots = [];
        for (const y of checkpoints) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const visible = [...(stage?.querySelectorAll(':scope > .home-brand .brand-showcase') || [])]
            .filter((hero) => {
              const rect = hero.getBoundingClientRect();
              return rect.bottom > (stage?.getBoundingClientRect().top || 0) + 1 && rect.top < (stage?.getBoundingClientRect().bottom || 0) - 1;
            });
          snapshots.push({ y, visible: visible.length, active: [...(stage?.querySelectorAll(':scope > .home-brand[data-active]') || [])].length });
        }
        for (const y of [...checkpoints].reverse()) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
        const crossings = [];
        for (const y of [firstBoundary + 36, firstBoundary + 3, firstBoundary - 2, firstBoundary + 2, firstBoundary - 36]) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          crossings.push({
            y,
            visible: [...(stage?.querySelectorAll(':scope > .home-brand .brand-showcase') || [])].filter((hero) => {
              const rect = hero.getBoundingClientRect();
              const bounds = stage?.getBoundingClientRect();
              return bounds && rect.bottom > bounds.top + 1 && rect.top < bounds.bottom - 1;
            }).length,
            active: [...(stage?.querySelectorAll(':scope > .home-brand[data-active]') || [])].length,
          });
        }
        return { count: stage?.querySelectorAll(':scope > .home-brand').length || 0, snapshots, crossings };
      });
      expect(stageMetrics.count).toBe(count);
      expect(stageMetrics.snapshots.slice(0, -1).every((snapshot) => snapshot.visible > 0)).toBe(true);
      expect(stageMetrics.snapshots.at(-1).visible).toBe(0);
      expect(stageMetrics.snapshots.every((snapshot) => snapshot.active === 1)).toBe(true);
      expect(stageMetrics.crossings.every((snapshot) => snapshot.visible > 0 && snapshot.active === 1)).toBe(true);
      layoutEvidence.push({ locale, width, ...geometry, stageMetrics });
      await page.locator('.menu-toggle').click();
      await expect(page.locator('.mobile-drawer.is-open')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.locator('.mobile-header-search-trigger').click();
      await expect(page.locator('.mobile-drawer.is-open')).toBeVisible();
      await page.locator('#mobile-header-search').fill('doll');
      await page.locator('#mobile-header-search').press('Enter');
      await expect(page).toHaveURL(new RegExp(`/${locale}/products\\?search=doll`));
      await context.close();
    }
  }

  const desktopContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await desktopContext.addInitScript(() => localStorage.setItem('play-language', 'en'));
  const desktop = await desktopContext.newPage();
  desktop.on('pageerror', (error) => failures.push(`desktop: ${error.message}`));
  desktop.on('console', (message) => { if (message.type() === 'error') failures.push(`desktop console: ${message.text()}`); });
  desktop.on('requestfailed', (request) => failures.push(`desktop request failed: ${request.url()} ${request.failure()?.errorText || ''}`));
  await desktop.goto('/en/brands/plush', { waitUntil: 'domcontentloaded' });
  await desktop.waitForSelector('#showcases .home-brand .brand-showcase');
  const desktopCount = await desktop.locator('#showcases .home-brand').count();
  expect(desktopCount).toBeGreaterThan(0);
  expect(desktopCount).toBeLessThan(10);
  await expect(desktop.locator('#showcases .brand-strip').first()).toBeAttached();
  await desktop.evaluate(() => window.scrollTo({ top: document.querySelector('#showcases')?.offsetTop + 900 || 1200, behavior: 'instant' }));
  await desktop.waitForTimeout(80);
  await desktop.screenshot({ path: path.join(evidencePath, 'en-desktop-category-deck.png'), fullPage: false });
  const viewAll = desktop.locator('#showcases .brand-strip__all').first();
  await expect(viewAll).toHaveAttribute('href', /\/en\/products\?brand=plush&category=/);
  await viewAll.evaluate((element) => element.click());
  await expect(desktop).toHaveURL(/\/en\/products\?brand=plush&category=/);
  expect(failures, 'no uncaught browser errors').toEqual([]);
  fs.writeFileSync(path.join(evidencePath, 'layout.json'), JSON.stringify(layoutEvidence, null, 2));
  await desktopContext.close();
});
