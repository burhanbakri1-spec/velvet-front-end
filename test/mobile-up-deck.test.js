import assert from 'node:assert/strict';
import test from 'node:test';
import { heroStageMotion, stageGeometry, stageReleaseBox } from '../src/components/heroScrollProgress.js';

const fractions = [0, .05, .1, .2, .35, .5, .65, .8, .9, 1];
const slides = Array.from({ length: 24 }, (_, i) => i % 2 ? { kind: 'strip', height: 235 } : { kind: 'hero' });
const height = 386;
const depth = 8;
const geometry = stageGeometry(slides, height);
const frame = (local, depth, mode = 'up') => heroStageMotion({ slides, local, stageHeight: height, geometry, mode, upDeckDepth: depth });
const visible = pose => !pose.hidden && pose.y + height - pose.clipBottom > 0 && pose.y + pose.clipTop < 772;

test('bounded UP decks retain the nearest and incoming heroes and cap historical slices', () => {
  for (let upper = 2; upper < 24; upper += 2) {
    for (const fraction of fractions) {
      const local = geometry.offsets[upper - 2] + (geometry.offsets[upper] - geometry.offsets[upper - 2]) * fraction;
      const poses = frame(local, depth);
      const active = poses.flatMap((p, i) => slides[i].kind === 'hero' && p.z > 1 ? [i] : []);
      assert.ok(active.length <= depth);
      if (fraction > 0 && fraction < 1) {
        assert.ok(active.includes(upper - 2), 'nearest hero must remain');
        assert.ok(active.includes(upper), 'incoming hero must remain');
      }
      for (let i = 0; i < slides.length; i += 2) {
        if (fraction > 0 && fraction < 1 && i < upper - (depth - 1) * 2) {
          assert.ok(!visible(poses[i]), 'retired historical heroes must be outside the stage');
          assert.equal(poses[i].clipTop + poses[i].clipBottom, 0);
        }
      }
    }
  }
});

test('the mobile window advances in banner order at full-bleed handoffs', () => {
  for (let hero = 2; hero < 22; hero += 2) {
    const local = geometry.offsets[hero];
    const at = frame(local, depth);
    assert.equal(at[hero].y, 0);
    assert.equal(at[hero].clipTop + at[hero].clipBottom, 0);
    for (const offset of [-.01, .01]) {
      const near = frame(local + offset, depth);
      assert.ok(Math.abs(near[hero].y) <= 1);
      assert.ok(near[hero].clipTop + near[hero].clipBottom <= 1);
    }
  }
});

test('bounded UP poses scrub continuously through every stage in both directions', () => {
  let previous = frame(0, depth);
  let unchanged = 0;
  for (let local = 1; local <= geometry.span; local++) {
    const next = frame(local, depth);
    for (let i = 0; i < slides.length; i += 2) if (visible(previous[i]) && visible(next[i])) {
      assert.ok(Math.abs(next[i].y - previous[i].y) <= 12, `visible hero jumped at ${local}`);
    }
    unchanged = JSON.stringify(previous) === JSON.stringify(next) ? unchanged + 1 : 0;
    assert.ok(unchanged <= 3, 'UP must not acquire a scroll hold');
    assert.deepEqual(frame(local - 1, depth), previous, 'reverse input must return the same pose');
    previous = next;
  }
});

test('the DOWN mapping and release geometry ignore the UP depth', () => {
  for (let local = 0; local <= geometry.span; local += 7) {
    const original = frame(local, undefined, 'down');
    const bounded = frame(local, depth, 'down');
    assert.deepEqual(bounded, original);
    assert.deepEqual(stageReleaseBox(slides, height, 772, local, 'down', geometry, bounded), stageReleaseBox(slides, height, 772, local, 'down', geometry, original));
  }
});

test('omitting a depth preserves the complete desktop deck', () => {
  const local = geometry.offsets[22] - 64;
  const full = frame(local);
  assert.equal(full.filter((p, i) => slides[i].kind === 'hero' && p.z > 1).length, 12);
  assert.deepEqual(frame(local, Infinity), full);
});

test('the selected eight-banner deck covers the released stage without blank gaps', () => {
  for (let local = 0; local <= geometry.span; local++) {
    const poses = frame(local, 8);
    const box = stageReleaseBox(slides, height, 772, local, 'up', geometry, poses);
    const intervals = poses.flatMap((p, i) => {
      if (p.hidden) return [];
      const h = slides[i].kind === 'strip' ? slides[i].height : height;
      const top = Math.max(0, p.y + p.clipTop), bottom = Math.min(box.boxHeight, p.y + h - p.clipBottom);
      return bottom > top ? [[top, bottom]] : [];
    }).sort((a, b) => a[0] - b[0]);
    let end = 0;
    for (const [top, bottom] of intervals) {
      assert.ok(top <= end + 1, `blank gap at scroll ${local}`);
      end = Math.max(end, bottom);
    }
    assert.ok(end >= box.boxHeight - 1, `uncovered stage tail at scroll ${local}`);
  }
});

test('phone UP decks never push the incoming banner beyond its endpoint and pull it back', () => {
 for(const stageHeight of [364,370,386,422]) {
  const geometry=stageGeometry(slides,stageHeight);
  for(let upper=2;upper<24;upper+=2) {
   let previous=Infinity;
   for(let local=geometry.offsets[upper-2];local<=geometry.offsets[upper];local++) {
    const poses=heroStageMotion({slides,stageHeight,local,mode:'up',geometry,upDeckDepth:8});
    assert.ok(poses[upper].y<=stageHeight,`incoming banner overshot ${stageHeight}px at ${local}`);
    // Reading this route upward (reverse local order) must never push the
    // incoming banner down and then pull it back above its final position.
    assert.ok(poses[upper].y<=previous,`incoming banner reversed at ${local}`);
    previous=poses[upper].y;
   }
  }
 }
});
