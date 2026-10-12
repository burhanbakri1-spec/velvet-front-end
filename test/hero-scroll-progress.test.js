import assert from 'node:assert/strict';
import test from 'node:test';
import { HERO_DECK_PEEK, heroStageMotion, stepHeroDirection } from '../src/components/heroScrollProgress.js';

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

function upFrame(heroes, anchorScrollY, distance) {
  const scrollY = anchorScrollY - distance;
  const motion = heroStageMotion({
    heroes,
    scrollY,
    header,
    viewportHeight,
    mode: 'up',
    distance,
    anchorScrollY,
  });
  const visualTop = (index) => heroes[index].top - scrollY + motion[index].shift;
  return { motion, visualTop };
}

test('scrolling down keeps every hero and strip in normal flow', () => {
  const heroes = column(4, 280);
  [0, 80, 400].forEach((distance) => {
    const motion = heroStageMotion({
      heroes,
      scrollY: heroes[1].top - header + distance,
      header,
      viewportHeight,
      mode: 'down',
      distance,
    });
    assert.ok(motion.every((item) => item.shift === 0 && item.clip === 0 && item.stripHidden === false));
  });
});

test('up from BUILD reveals PLAY immediately, then KIDS and BABY as stacked cards', () => {
  const heroes = column(4, 0);
  const anchor = heroes[3].top - header;
  const first = upFrame(heroes, anchor, 40);
  assert.equal(Math.round(first.visualTop(2)), header);
  assert.equal(Math.round(first.visualTop(3)), header + 40);
  assert.equal(first.motion[1].z, undefined);
  assert.ok(first.visualTop(1) + heroHeight <= header + 0.5);
  assert.equal(first.motion[2].stripHidden, true);
  assert.equal(first.motion[3].stripHidden, false);
  assert.ok(first.motion.every((item) => item.clip === 0));

  const second = upFrame(heroes, anchor, HERO_DECK_PEEK + 40);
  assert.equal(Math.round(second.visualTop(1)), header);
  assert.equal(Math.round(second.visualTop(2)), header + 40);
  assert.equal(Math.round(second.visualTop(3)), header + HERO_DECK_PEEK + 40);
  assert.ok(second.visualTop(0) + heroHeight <= header + 0.5);

  const third = upFrame(heroes, anchor, HERO_DECK_PEEK * 2 + 50);
  assert.equal(Math.round(third.visualTop(0)), header);
  assert.equal(Math.round(third.visualTop(1)), header + 50);
  assert.equal(Math.round(third.visualTop(2)), header + 50 + HERO_DECK_PEEK);
  assert.equal(Math.round(third.visualTop(3)), header + HERO_DECK_PEEK * 2 + 50);
  assert.ok(third.motion.slice(0, 3).every((item) => item.stripHidden === true));
  assert.equal(third.motion[3].stripHidden, false);
});

test('the deck follows upward distance and does not pop in at zero', () => {
  const heroes = column(4, 0);
  const anchor = heroes[2].top - header;
  const idle = upFrame(heroes, anchor, 0);
  assert.ok(idle.motion.every((item) => item.shift === 0 && item.stripHidden === false && item.clip === 0));
  const slow = upFrame(heroes, anchor, 320);
  const fast = upFrame(heroes, anchor, 320);
  assert.deepEqual(slow.motion, fast.motion);
  assert.ok(slow.visualTop(2) > header);
});

test('a downward delta clears the deck model and an upward delta enters it', () => {
  assert.equal(stepHeroDirection('down', -12), 'up');
  assert.equal(stepHeroDirection('up', 4), 'down');
  assert.equal(stepHeroDirection('up', 0), 'up');
  assert.equal(stepHeroDirection('down', 0), 'down');
});

test('up motion never clips, and strips below the current hero stay visible', () => {
  const heroes = column(4, 280);
  const { motion } = upFrame(heroes, heroes[2].top - header, 180);
  assert.ok(motion.every((item) => item.clip === 0));
  assert.equal(motion[0].stripHidden, true);
  assert.equal(motion[1].stripHidden, true);
  assert.equal(motion[2].stripHidden, false);
  assert.equal(motion[3].stripHidden, false);
});
