import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HERO_SLICE,
  HERO_SLICE_OVERLAP,
  heroStageMotion,
  stepHeroDirection,
} from '../src/components/heroScrollProgress.js';

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
  const boxTop = (index) => heroes[index].top - scrollY + motion[index].shift;
  const visibleTop = (index) => boxTop(index) + motion[index].clip;
  const visibleHeight = (index) => heroes[index].height - motion[index].clip;
  return { motion, boxTop, visibleTop, visibleHeight };
}

test('downward scroll keeps hero, strip, hero in order and never conceals a strip', () => {
  const heroes = column(4, 280);
  [0, 1, 2].forEach((current) => {
    const flushY = heroes[current].top - header;
    [0, 1, 80, 420].forEach((distance) => {
      const moved = frame(heroes, flushY + distance, 'down');
      assert.equal(Math.round(header - moved.boxTop(current)), distance);
      const gap = moved.boxTop(current + 1) - (moved.boxTop(current) + heroHeight);
      assert.equal(Math.round(gap), 280);
      assert.ok(moved.motion.every((item) => item.shift === 0 && item.clip === 0 && item.stripHidden === false && !item.z));
    });
  });
});

test('upward scroll from PLAY stacks BABY and KIDS as thin slices under the header', () => {
  const heroes = column(4, 0);
  const play = 2;
  const opened = frame(heroes, heroes[play].top - header - 180, 'up');
  const baby = opened.visibleHeight(0);
  const kids = opened.visibleHeight(1);
  assert.ok(baby > 1 && baby <= HERO_SLICE);
  assert.ok(kids > baby && kids < heroHeight * 0.5);
  assert.equal(opened.motion[play].clip, 0);
  assert.ok(opened.visibleTop(0) >= header - 1);
  assert.ok(opened.visibleTop(0) < opened.visibleTop(1));
  assert.ok(Math.abs(opened.visibleTop(1) + kids - opened.boxTop(play)) <= HERO_SLICE_OVERLAP + 2);
  assert.equal(opened.motion[0].stripHidden, true);
  assert.equal(opened.motion[1].stripHidden, true);
  assert.equal(opened.motion[play].stripHidden, false);
  assert.ok(opened.motion[3].clip === 0 && opened.motion[3].shift === 0);
});

test('continuing up lets the nearest slice become the full hero and leaves the older one thin', () => {
  const heroes = column(4, 0);
  const kidsFlush = heroes[1].top - header;
  const almost = frame(heroes, kidsFlush + 24, 'up');
  assert.ok(almost.visibleHeight(1) > heroHeight * 0.9);
  assert.ok(almost.visibleHeight(0) < HERO_SLICE);
  assert.equal(almost.motion[2].clip, 0);

  const arrived = frame(heroes, kidsFlush, 'up');
  assert.ok(arrived.motion.every((item) => item.shift === 0 && item.clip === 0 && item.stripHidden === false));

  const past = frame(heroes, kidsFlush - 40, 'up');
  assert.ok(past.visibleHeight(0) > 1 && past.visibleHeight(0) < HERO_SLICE);
  assert.equal(past.motion[1].clip, 0);
  assert.equal(past.motion[2].shift, 0);
  assert.equal(past.motion[2].clip, 0);
  assert.equal(past.motion[0].stripHidden, true);
  assert.equal(past.motion[1].stripHidden, false);
});

test('the same scroll position is the same frame, and down restores every strip', () => {
  const heroes = column(4, 0);
  const scrollY = heroes[2].top - header - 180;
  const slow = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'up' });
  const fast = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'up' });
  assert.deepEqual(slow, fast);
  const down = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'down' });
  assert.ok(down.every((item) => item.shift === 0 && item.clip === 0 && item.stripHidden === false && !item.z));
  assert.notDeepEqual(down, slow);
});

test('a downward delta leaves the upward model and an upward delta enters it', () => {
  assert.equal(stepHeroDirection('down', -12), 'up');
  assert.equal(stepHeroDirection('up', 4), 'down');
  assert.equal(stepHeroDirection('up', 0), 'up');
  assert.equal(stepHeroDirection('down', 0), 'down');
});
