import assert from 'node:assert/strict';
import test from 'node:test';
import { aboutSections } from '../src/data/company.js';
import { normalizeVelvetIdentityCopy } from '../src/data/platformContent.js';

test('About story copy uses VELVET identity, not PLAY-as-company', () => {
  const blob = JSON.stringify(aboutSections);
  assert.match(blob, /VELVET/);
  assert.doesNotMatch(blob, /\bPLAY begins\b/);
  assert.doesNotMatch(blob, /Meet the PLAY team/);
  assert.doesNotMatch(blob, /Why we play/);
  assert.doesNotMatch(blob, /Play it forward/);
  assert.equal(aboutSections[0].eyebrow, 'Why VELVET');
  assert.match(aboutSections[0].paragraphs[0], /^VELVET begins/);
});

test('normalizeVelvetIdentityCopy rewrites PLAY company identity only', () => {
  assert.equal(normalizeVelvetIdentityCopy('PLAY begins with wonder'), 'VELVET begins with wonder');
  assert.equal(normalizeVelvetIdentityCopy('Meet the PLAY team'), 'Meet the VELVET team');
  assert.equal(normalizeVelvetIdentityCopy('Why we play'), 'Why VELVET');
  assert.equal(normalizeVelvetIdentityCopy('Play it forward'), 'For tomorrow');
  assert.equal(normalizeVelvetIdentityCopy('children love creative play'), 'children love creative play');
  assert.equal(normalizeVelvetIdentityCopy('VELVET PLAY'), 'VELVET PLAY');
});
