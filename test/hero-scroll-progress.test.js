import assert from 'node:assert/strict';
import test from 'node:test';
import { heroStageMotion } from '../src/components/heroScrollProgress.js';

const header = 88;
const viewportHeight = 900;
const visible = viewportHeight - header;
const heroHeight = 1100;

function column(count, pairGap = 0, height = heroHeight) {
  const heroes = [];
  let top = 2000;
  for (let index = 0; index < count; index += 1) {
    heroes.push({ top, height });
    top += height + pairGap;
  }
  return heroes;
}

function frame(heroes, scrollY) {
  const motion = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  const visualTop = (index) => heroes[index].top - scrollY + motion[index].shift;
  return { motion, visualTop };
}

test('a flush hero is the settled frame and keeps every clip clear', () => {
  const heroes = column(4, 0);
  const { motion, visualTop } = frame(heroes, heroes[2].top - header);
  assert.equal(motion[2].shift, 0);
  assert.equal(Math.round(visualTop(2)), header);
  assert.equal(motion[2].stripHidden, false);
  assert.ok(motion.every((item) => item.clip === 0));
});

test('PLAY to KIDS, BUILD to PLAY, and KIDS to BABY reveal the previous hero 1:1 from the first upward pixels', () => {
  const heroes = column(4, 0);
  [2, 3, 1].forEach((current) => {
    const flushY = heroes[current].top - header;
    const flush = frame(heroes, flushY);
    [50, 150].forEach((distance) => {
      const { motion, visualTop } = frame(heroes, flushY - distance);
      const currentDrop = visualTop(current) - flush.visualTop(current);
      const previousDrop = visualTop(current - 1) - flush.visualTop(current - 1);
      assert.ok(currentDrop > 0, 'current hero moves down immediately');
      assert.equal(Math.round(currentDrop), Math.round(previousDrop));
      assert.equal(Math.round(visualTop(current) - header), Math.round(currentDrop));
      assert.ok(visualTop(current - 1) < header);
      assert.ok(visualTop(current - 1) + heroes[current - 1].height > header);
      assert.ok(motion.every((item) => item.clip === 0));
    });
  });
});

test('downward scroll brings the next hero in from below by the same distance the current hero moves up', () => {
  const heroes = column(4, 0);
  [1, 2].forEach((current) => {
    const flushY = heroes[current].top - header;
    const flush = frame(heroes, flushY);
    [50, 150].forEach((distance) => {
      const { motion, visualTop } = frame(heroes, flushY + distance);
      const currentRise = flush.visualTop(current) - visualTop(current);
      const nextTop = visualTop(current + 1);
      const revealed = viewportHeight - nextTop;
      assert.ok(currentRise > 0, 'current hero moves up immediately');
      assert.equal(Math.round(currentRise), Math.round(revealed));
      assert.ok(nextTop < viewportHeight);
      assert.ok(nextTop > header);
      assert.equal(motion[current].clip, 0);
      assert.equal(motion[current + 1].clip, 0);
    });
  });
});

test('stopping halfway is the same frame as arriving there quickly', () => {
  const heroes = column(4, 0);
  const scrollY = heroes[2].top - header - 320;
  const slow = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  const fast = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  assert.deepEqual(slow, fast);
  const { visualTop } = frame(heroes, scrollY);
  const flush = frame(heroes, heroes[2].top - header);
  assert.ok(visualTop(2) > flush.visualTop(2));
  assert.equal(Math.round(visualTop(2) - header), Math.round(visualTop(1) - flush.visualTop(1)));
});

test('the same scroll offset always returns the same motion, including a large jump', () => {
  const heroes = column(4, 280);
  const scrollY = heroes[2].top - header - 900;
  const first = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  const second = heroStageMotion({ heroes, scrollY, header, viewportHeight });
  assert.deepEqual(first, second);
  const restored = heroStageMotion({
    heroes,
    scrollY: heroes[2].top - header,
    header,
    viewportHeight,
  });
  assert.equal(restored[2].shift, 0);
  assert.equal(restored[2].stripHidden, false);
  assert.ok(restored.every((item) => item.clip === 0));
});

test('a strip between heroes stays concealed during the handoff and returns when the next hero is flush', () => {
  const heroes = column(4, 280);
  const span = heroHeight + 280;
  const mid = heroStageMotion({
    heroes,
    scrollY: heroes[2].top - header + span / 2,
    header,
    viewportHeight,
  });
  assert.equal(mid[2].stripHidden, true);
  assert.equal(mid[2].clip, 0);
  assert.equal(mid[1].stripHidden, false);
  assert.equal(mid[3].stripHidden, false);

  const arrived = heroStageMotion({
    heroes,
    scrollY: heroes[3].top - header,
    header,
    viewportHeight,
  });
  assert.equal(arrived[2].stripHidden, false);
  assert.equal(arrived[3].shift, 0);
  assert.equal(arrived[3].stripHidden, false);
});

test('a hero shorter than the viewport keeps normal document flow', () => {
  const heroes = column(3, 0, 668);
  const motion = heroStageMotion({
    heroes,
    scrollY: heroes[1].top - header + 220,
    header,
    viewportHeight,
  });
  assert.ok(motion.every((item) => item.shift === 0 && item.clip === 0 && item.stripHidden === false));
});

test('up and down through one offset describe one continuous range', () => {
  const heroes = column(4, 0);
  const span = heroHeight;
  const early = frame(heroes, heroes[2].top - header + 80);
  const later = frame(heroes, heroes[2].top - header + 80 + span / 2);
  assert.ok(later.visualTop(2) < early.visualTop(2));
  assert.ok(later.visualTop(3) < early.visualTop(3));
  const currentTravel = early.visualTop(2) - later.visualTop(2);
  const nextTravel = early.visualTop(3) - later.visualTop(3);
  assert.equal(Math.round(currentTravel), Math.round(nextTravel));
  assert.ok(currentTravel > visible / 4);
});
