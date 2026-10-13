import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HERO_SLICE,
  heroStageMotion,
  stepHeroDirection,
} from '../src/components/heroScrollProgress.js';

const header = 88;
const viewportHeight = 900;
const heroHeight = 668;

function column(count, gaps = [], height = heroHeight) {
  const heroes = [];
  let top = 2400;
  for (let index = 0; index < count; index += 1) {
    heroes.push({ top, height });
    top += height + (gaps[index] ?? 0);
  }
  return heroes;
}

function frame(heroes, scrollY, mode) {
  const motion = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode });
  const boxTop = (index) => heroes[index].top - scrollY + motion[index].shift;
  const visibleTop = (index) => boxTop(index) + (motion[index].clip || 0);
  const visibleHeight = (index) => heroes[index].height - (motion[index].clip || 0) - (motion[index].foot || 0);
  return { motion, boxTop, visibleTop, visibleHeight };
}

test('downward stage heroes slide flush, with the next section entering from the fold', () => {
  const stage = viewportHeight - header;
  const heroes = column(4, [], stage);
  const flushY = heroes[0].top - header;
  const start = frame(heroes, flushY, 'down');
  assert.equal(start.boxTop(0), header);
  assert.equal(start.boxTop(1), viewportHeight);
  assert.ok(start.motion.every((item) => item.shift === 0 && item.clip === 0 && item.foot === 0 && item.stripHidden === false));

  for (const distance of [1, 40, 200, 500, stage]) {
    const current = frame(heroes, flushY + distance, 'down');
    assert.equal(current.boxTop(0), header - distance);
    assert.equal(current.boxTop(1), current.boxTop(0) + stage);
    assert.ok(current.boxTop(1) < viewportHeight);
    assert.ok(current.motion.every((item) => item.shift === 0 && item.stripHidden === false && item.clip === 0));
  }

  const arrived = frame(heroes, heroes[1].top - header, 'down');
  const before = frame(heroes, heroes[1].top - header - 1, 'down');
  assert.equal(arrived.boxTop(1), header);
  assert.equal(before.boxTop(2), arrived.boxTop(2) + 1);
});

test('a product strip stays between heroes on the way down', () => {
  const stage = viewportHeight - header;
  const heroes = column(3, [280, 0], stage);
  const flushY = heroes[0].top - header;
  for (const distance of [0, 120, 280, 500, 800]) {
    const current = frame(heroes, flushY + distance, 'down');
    const visualGap = current.boxTop(1) - (current.boxTop(0) + stage);
    assert.equal(visualGap, 280, `distance=${distance}: strip collapsed to ${visualGap}`);
    assert.ok(current.motion.every((item) => item.stripHidden === false && item.clip === 0 && item.shift === 0));
  }
});

test('upward slices show the top edge and sit under the header', () => {
  const heroes = column(4);
  const play = 2;
  const opened = frame(heroes, heroes[play].top - header - 180, 'up');
  assert.ok(opened.visibleHeight(0) > 20 && opened.visibleHeight(0) <= HERO_SLICE);
  assert.ok(opened.visibleHeight(1) > 20 && opened.visibleHeight(1) <= HERO_SLICE);
  assert.ok(opened.motion[0].clip > 0 && opened.motion[0].clip <= 34);
  assert.ok(opened.motion[1].clip > 0 && opened.motion[1].clip <= 34);
  assert.ok(opened.motion[0].foot > heroHeight - HERO_SLICE - 40);
  assert.ok(Math.abs(opened.visibleTop(0) - header) <= 1);
  assert.ok(opened.visibleTop(1) > opened.visibleTop(0));
  assert.ok(opened.visibleTop(1) < opened.visibleTop(0) + HERO_SLICE);
  assert.equal(opened.motion[play].clip, 0);
  assert.equal(opened.motion[play].foot, 0);
  assert.ok(Math.abs(opened.boxTop(play) - (opened.visibleTop(1) + opened.visibleHeight(1))) <= 2);
  assert.equal(opened.motion[0].stripHidden, true);
  assert.equal(opened.motion[1].stripHidden, true);
  assert.equal(opened.motion[play].stripHidden, false);
});

test('the nearest top edge grows into the full hero while older edges stay thin', () => {
  const heroes = column(4);
  const kidsFlush = heroes[1].top - header;
  const early = frame(heroes, heroes[2].top - header - 180, 'up');
  const later = frame(heroes, heroes[2].top - header - 560, 'up');
  assert.ok(later.visibleHeight(1) > early.visibleHeight(1) + 80);
  assert.ok(later.visibleHeight(0) <= HERO_SLICE);
  assert.ok(later.motion[0].clip > 0 && later.motion[0].clip <= 34);
  assert.ok(later.boxTop(2) > early.boxTop(2));

  const arrived = frame(heroes, kidsFlush, 'up');
  assert.ok(arrived.motion.every((item) => item.shift === 0 && item.clip === 0 && item.foot === 0 && item.stripHidden === false));

  const above = frame(heroes, kidsFlush - 48, 'up');
  assert.ok(above.visibleHeight(0) > 20 && above.visibleHeight(0) <= HERO_SLICE);
  assert.ok(above.motion[0].clip > 0);
  assert.ok(above.motion[0].foot > 0);
  assert.equal(above.motion[1].foot, 0);
  assert.ok(above.boxTop(1) > header);
});

test('the same scroll position is the same frame, and down restores every strip', () => {
  const heroes = column(4);
  const scrollY = heroes[2].top - header - 180;
  const slow = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'up' });
  const fast = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'up' });
  assert.deepEqual(slow, fast);
  const down = heroStageMotion({ heroes, scrollY, header, viewportHeight, mode: 'down' });
  assert.ok(down.every((item) => item.clip === 0 && item.foot === 0 && item.stripHidden === false));
  assert.notDeepEqual(down.map((item) => item.shift), slow.map((item) => item.shift));
});

test('a downward delta leaves the upward model and an upward delta enters it', () => {
  assert.equal(stepHeroDirection('down', -12), 'up');
  assert.equal(stepHeroDirection('up', 4), 'down');
  assert.equal(stepHeroDirection('up', 0), 'up');
  assert.equal(stepHeroDirection('down', 0), 'down');
  assert.ok(HERO_SLICE >= 50 && HERO_SLICE <= 70);
});
