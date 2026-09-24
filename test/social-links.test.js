import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { socialLinkOrder, socialLinks } from '../src/data/socialLinks.js';
import { translations } from '../src/i18n/translations.js';

const footer = fs.readFileSync(new URL('../src/components/Footer.jsx', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('official social links cover WhatsApp, Facebook, Instagram, and TikTok', () => {
  assert.equal(
    socialLinks.whatsapp,
    'https://api.whatsapp.com/send/?phone=970598431743&text&type=phone_number&app_absent=0',
  );
  assert.equal(socialLinks.facebook, 'https://www.facebook.com/velvetkids123/');
  assert.equal(socialLinks.instagram, 'https://www.instagram.com/velvetkids123/?next=%2F');
  assert.equal(socialLinks.tiktok, 'https://www.tiktok.com/@velvet.kids');
  assert.deepEqual(socialLinkOrder, ['whatsapp', 'facebook', 'instagram', 'tiktok']);
});

test('footer Follow group wires official social URLs in a new tab', () => {
  assert.match(footer, /from '\.\.\/data\/socialLinks'/);
  assert.match(footer, /socialLinkOrder\.map/);
  assert.match(footer, /target="_blank"/);
  assert.match(footer, /rel="noopener noreferrer"/);
  assert.doesNotMatch(footer, /linkedin|youtube/);
});

test('Contact page wires official social links with icons', () => {
  const contactPage = fs.readFileSync(new URL('../src/pages/ContactPage.jsx', import.meta.url), 'utf8');
  const contactSocial = fs.readFileSync(new URL('../src/components/ContactSocialLinks.jsx', import.meta.url), 'utf8');
  assert.match(contactPage, /ContactSocialLinks/);
  assert.match(contactSocial, /from '\.\.\/data\/socialLinks'/);
  assert.match(contactSocial, /socialLinkOrder\.map/);
  assert.match(contactSocial, /socialLinks\[key\]/);
  assert.doesNotMatch(contactSocial, /linkedin|youtube/);
  assert.ok(translations.en.contact.socialTitle);
  assert.ok(translations.ar.contact.socialTitle);
});

test('footer social labels exist in EN and AR', () => {
  for (const key of socialLinkOrder) {
    assert.ok(translations.en.footer[key], `missing EN footer.${key}`);
    assert.ok(translations.ar.footer[key], `missing AR footer.${key}`);
  }
});

test('bootstrap loader shows VELVET branding, not i-play', () => {
  assert.match(main, /Loading VELVET…/);
  assert.doesNotMatch(main, /Loading i-play/);
  assert.match(main, /platform-content-loading/);
});
