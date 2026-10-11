import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { railLogoFit, railWordmarkNameSize, railWordmarkSvg, RAIL_WORDMARK } from '../src/components/railLogoFit.js';

const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('previous-brand slices crop the real hero instead of restyling a logo', () => {
  const stack = fs.readFileSync(new URL('../src/components/BrandBannerStack.jsx', import.meta.url), 'utf8');
  assert.match(styles, /#showcases > \.brand-banner-stack \{[^}]*position:\s*fixed[^}]*background:\s*transparent/);
  assert.match(styles, /\.brand-banner-slice \{[^}]*height:\s*148px[^}]*overflow:\s*hidden/);
  assert.match(styles, /\.brand-banner-slice__stage \.brand-showcase__image \{[^}]*object-fit:\s*cover[^}]*object-position:\s*center top/);
  assert.match(stack, /className="brand-showcase__image"/);
  assert.match(stack, /getBrandLogo\(brand\.slug, locale\)/);
  assert.match(stack, /brand-showcase__brand-logo-frame/);
  assert.doesNotMatch(stack, /brand-banner-slice__logo/);
  assert.doesNotMatch(styles, /\.brand-banner-slice__logo/);
});

test('padded logos scale to the same visual height and stay inside the max box', () => {
  const short = railLogoFit({
    natW: 300, natH: 94, inkX: 106, inkY: 16, inkW: 86, inkH: 72, maxW: 95, maxH: 31,
  });
  const wide = railLogoFit({
    natW: 300, natH: 94, inkX: 98, inkY: 16, inkW: 105, inkH: 65, maxW: 95, maxH: 31,
  });
  assert.ok(Math.abs(short.visualH - 31) < 0.05);
  assert.ok(Math.abs(wide.visualH - 31) < 0.05);
  assert.ok(short.visualW <= 95);
  assert.ok(wide.visualW <= 95);
  assert.ok(Math.abs(short.visualW / short.visualH - 86 / 72) < 0.02);
  assert.ok(Math.abs(wide.visualW / wide.visualH - 105 / 65) < 0.02);
});

test('generated rail wordmarks share one type size and cap center', () => {
  assert.equal(railWordmarkNameSize(), RAIL_WORDMARK.nameSize);
  const baby = railWordmarkSvg({ branch: 'BABY', accent: '2f7d5e', nameWidth: 90 });
  const collect = railWordmarkSvg({ branch: 'COLLECT', accent: '9c5f2e', nameWidth: 180 });
  assert.match(baby, /font-size="40"/);
  assert.match(collect, /font-size="40"/);
  assert.match(baby, /viewBox="0 0 102 64"/);
  assert.match(collect, /viewBox="0 0 192 64"/);
  assert.match(baby, /fill="#2f7d5e"/);
  const baseline = RAIL_WORDMARK.capCenter + (RAIL_WORDMARK.nameSize * RAIL_WORDMARK.capRatio) / 2;
  const capTop = baseline - RAIL_WORDMARK.nameSize * RAIL_WORDMARK.capRatio;
  assert.ok(Math.abs((capTop + baseline) / 2 - RAIL_WORDMARK.capCenter) < 0.01);
});

test('uneven transparent padding is recentered without changing a tight logo', () => {
  const low = railLogoFit({
    natW: 300, natH: 94, inkX: 106, inkY: 22, inkW: 86, inkH: 65, maxW: 95, maxH: 31,
  });
  const high = railLogoFit({
    natW: 300, natH: 94, inkX: 106, inkY: 8, inkW: 86, inkH: 65, maxW: 95, maxH: 31,
  });
  assert.ok(low.ty < 0, 'artwork sitting low moves up');
  assert.ok(high.ty > 0, 'artwork sitting high moves down');
  assert.ok(Math.abs(low.visualH - high.visualH) < 0.05);

  const tight = railLogoFit({
    natW: 200, natH: 80, inkX: 0, inkY: 0, inkW: 200, inkH: 80, maxW: 95, maxH: 31,
  });
  assert.ok(Math.abs(tight.boost - 1) < 0.02);
  assert.ok(Math.abs(tight.tx) < 0.5);
  assert.ok(Math.abs(tight.ty) < 0.5);
});
