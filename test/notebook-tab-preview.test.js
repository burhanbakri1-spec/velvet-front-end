import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookReleaseAllowance, notebookTabLifts } from '../src/components/notebookTabPreview.js';

test('the combined tab trial clears a stacked logo and the next tab within the header pocket', () => {
  const slides = [
    { kind: 'hero', notebookHeight: 386, notebookLogo: { top: 18, bottom: 83 } },
    { kind: 'hero', notebookHeight: 386, notebookLogo: { top: 19, bottom: 85 } },
    { kind: 'hero', notebookHeight: 386 },
  ];
  const motion = [0, 35, 70].map((y) => ({ y, z: y, hidden: false, clipTop: 0, clipBottom: 322 }));
  const before = structuredClone(motion);
  const lift = notebookTabLifts(slides, motion, 772, 28, 70);
  const bounds = motion.map(({ y }, i) => [y - lift[i] - 28, y - lift[i]]);

  assert.ok(bounds[1][1] < 18, 'the right-edge Kids crown clears the prior BABY mark');
  assert.ok(bounds[2][1] < 54, 'the next tab clears the Kids mark');
  assert.ok(bounds[0][1] <= bounds[1][0]);
  assert.ok(bounds[1][1] <= bounds[2][0]);
  assert.ok(bounds[0][0] >= -70);
  assert.deepEqual(motion, before, 'tab placement leaves all motion poses intact');
});

test('only eligible onstage banner tops take part in positioning', () => {
  const slides = [
    { kind: 'hero', notebookHeight: 386 },
    { kind: 'strip' },
    { kind: 'hero', notebookHeight: 386 },
  ];
  const motion = [
    { y: 0, hidden: false, clipTop: 0, clipBottom: 0 },
    { y: 240, hidden: false },
    { y: 772, hidden: false, clipTop: 0, clipBottom: 0 },
  ];
  assert.deepEqual(notebookTabLifts(slides, motion, 772, 28, 70), [0]);
});

test('release allowance only pays the measured sticky deficit and tapers after the final strip', () => {
  const allowance = raw => notebookReleaseAllowance(raw, 7000, 7238, 238, 48);
  assert.equal(allowance(-1), 0);
  assert.equal(allowance(6952), 0);
  assert.equal(allowance(6976), 24);
  assert.equal(allowance(7000), 48);
  assert.equal(allowance(7001), 47);
  assert.equal(allowance(7024), 24);
  assert.equal(allowance(7048), 0);
  assert.equal(notebookReleaseAllowance(7000, 7000, 7300, 238, 48), 0);
});
