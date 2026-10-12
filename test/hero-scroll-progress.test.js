import assert from 'node:assert/strict';
import test from 'node:test';
import { heroStageMotion, stepHeroDirection } from '../src/components/heroScrollProgress.js';

const header = 88;
const viewportHeight = 900;
const heroHeight = 668;

function column(count, pairGap = 0, height = heroHeight) {
  const heroes = [];
  let top = 2400;
  for (let index = 0; index < count; index += 1) {
    heroes.push({ top, height });
    top += height + pairGap;
  }
  return heroes;
}

function frame(heroes, scrollY, mode) {
  const motion = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode });
  const visualTop = (index) => heroes[index].top - scrollY + motion[index].shift;
  return { motion, visualTop };
}

test('downward BABY to KIDS to PLAY to BUILD slides the next full hero up over the current one', () => {
  const heroes = column(4, 0);
  [0, 1, 2].forEach((current) => {
    const flushY = heroes[current].top - header;
    const flush = frame(heroes, flushY, 'down');
    assert.equal(flush.motion[current].shift, 0);
    assert.equal(flush.motion[current + 1].shift, 0);
    assert.equal(Math.round(flush.visualTop(current + 1)), Math.round(flush.visualTop(current) + heroHeight));
    [1, 50, 150].forEach((distance) => {
      const moved = frame(heroes, flushY + distance, 'down');
      const currentRise = flush.visualTop(current) - moved.visualTop(current);
      const nextRise = flush.visualTop(current + 1) - moved.visualTop(current + 1);
      assert.equal(Math.round(currentRise), distance);
      assert.ok(nextRise > distance);
      assert.ok(moved.motion[current + 1].shift < 0);
      assert.ok(moved.visualTop(current + 1) < moved.visualTop(current) + heroHeight);
      assert.ok(moved.motion.every((item) => item.clip === 0 && !item.z));
    });
    const later = frame(heroes, flushY + 400, 'down');
    const earlier = frame(heroes, flushY + 150, 'down');
    assert.ok(later.visualTop(current + 1) < earlier.visualTop(current + 1));
  });
});

test('a strip stays out of the downward slide and returns when the next hero arrives', () => {
  const heroes = column(4, 280);
  const mid = frame(heroes, heroes[1].top - header + 80, 'down');
  assert.equal(mid.motion[1].stripHidden, true);
  assert.equal(mid.motion[0].stripHidden, false);
  assert.equal(mid.motion[2].stripHidden, false);
  assert.ok(mid.motion[2].shift < 0);
  assert.ok(mid.motion.every((item) => item.clip === 0));

  const arrived = frame(heroes, heroes[2].top - header, 'down');
  assert.equal(arrived.motion[1].stripHidden, false);
  assert.equal(arrived.motion[1].shift, 0);
});

test('upward BUILD to PLAY to KIDS brings in one full previous hero and leaves the older ones uncropped', () => {
  const heroes = column(4, 0);
  const buildFlush = heroes[3].top - header;
  const first = frame(heroes, buildFlush - 40, 'up');
  assert.equal(Math.round(first.visualTop(3) - header), 40);
  assert.equal(Math.round(first.visualTop(2) + heroHeight), Math.round(first.visualTop(3)));
  assert.equal(first.motion[1].shift, 0);
  assert.equal(first.motion[0].shift, 0);
  assert.equal(first.motion[1].z, undefined);
  assert.ok(first.motion.every((item) => item.clip === 0 && item.stripHidden === false));

  const kids = frame(heroes, buildFlush - heroHeight - 40, 'up');
  assert.equal(kids.motion[0].shift, 0);
  assert.equal(Math.round(kids.visualTop(1) + heroHeight), Math.round(kids.visualTop(2)));
  assert.ok(kids.visualTop(0) + heroHeight < header);
});

test('the same scroll position is the same frame, and the two directions are not the same model', () => {
  const heroes = column(4, 280);
  const scrollY = heroes[2].top - header - 120;
  const slow = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'up' });
  const fast = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'up' });
  assert.deepEqual(slow, fast);
  const down = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'down' });
  assert.notDeepEqual(down.map((item) => item.shift), slow.map((item) => item.shift));
  assert.ok(slow.every((item) => item.clip === 0));
  assert.ok(down.every((item) => item.clip === 0));
});

test('a downward delta leaves the upward model and an upward delta enters it', () => {
  assert.equal(stepHeroDirection('down', -12), 'up');
  assert.equal(stepHeroDirection('up', 4), 'down');
  assert.equal(stepHeroDirection('up', 0), 'up');
  assert.equal(stepHeroDirection('down', 0), 'down');
});
