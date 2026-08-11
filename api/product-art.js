const products = {
  'pocket-worlds-starter-set': ['#ffad32', '#ff5f45', '#79233b'],
  'odd-pals-plush': ['#d95ad1', '#8af06d', '#4d1760'],
  'tiny-table-bake-studio': ['#ffd0dc', '#fff0c5', '#a63b68'],
  'neon-racers-twin-pack': ['#182045', '#1fd8f2', '#ff275f'],
  'bloom-pets-surprise-pod': ['#f1a1e5', '#9ce6dd', '#ffd056'],
  'splash-lab-water-blaster': ['#25c8e8', '#ffea4a', '#1460aa'],
  'build-club-maker-kit': ['#ff8349', '#ffd242', '#824229'],
  'cloud-dough-color-pack': ['#819dff', '#ef9fe3', '#473d92'],
};

const escapeXml = (value) => String(value).replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]));

export default function handler(request, response) {
  const slug = String(request.query?.slug || '');
  const colors = products[slug];
  if (!colors) return response.status(404).send('Not found');
  const scene = ['primary', 'hover', 'detail'].indexOf(String(request.query?.scene || 'primary'));
  const rotated = scene > 0 ? [...colors.slice(scene), ...colors.slice(0, scene)] : colors;
  const [a, b, c] = rotated;
  const title = slug.split('-').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 820"><defs><radialGradient id="g"><stop stop-color="${a}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs><rect width="960" height="820" fill="url(#g)"/><circle cx="770" cy="145" r="170" fill="#fff" opacity=".12"/><rect x="230" y="170" width="500" height="500" rx="120" fill="${b}"/><circle cx="390" cy="360" r="38" fill="#151225"/><circle cx="555" cy="360" r="38" fill="#151225"/><path d="M390 500 Q475 570 560 500" fill="none" stroke="#151225" stroke-width="26" stroke-linecap="round"/><text x="62" y="745" fill="#fff" font-family="Arial" font-size="46" font-weight="900">${escapeXml(title)}</text></svg>`;
  response.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return response.status(200).send(svg);
}
