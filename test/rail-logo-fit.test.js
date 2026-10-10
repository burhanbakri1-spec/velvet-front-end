import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { railLogoFit } from '../src/components/railLogoFit.js';

const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('logo rail uses one light row with a shared box and contain max size', () => {
  assert.match(styles, /#showcases > \.brand-logo-rail \{[^}]*flex-wrap:\s*nowrap[^}]*overflow-x:\s*auto[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.92\)/);
  assert.match(styles, /\.brand-logo-rail__item \{[^}]*width:\s*104px[^}]*height:\s*40px[^}]*background:\s*transparent/);
  assert.match(styles, /\.brand-logo-rail__item img \{[^}]*max-width:\s*96px[^}]*max-height:\s*32px[^}]*object-fit:\s*contain[^}]*object-position:\s*center/);
  assert.doesNotMatch(styles, /\.brand-logo-rail__item \{[^}]*#17151f/);
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
