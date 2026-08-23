export function artwork(title, colors, scene = 0) {
  const [a, b, c] = colors;
  const safeTitle = title.replace(/&/g, '&amp;');
  const shapes = [
    `<rect x="260" y="185" width="430" height="500" rx="120" fill="${b}"/><circle cx="390" cy="360" r="38" fill="#151225"/><circle cx="555" cy="360" r="38" fill="#151225"/><path d="M390 500 Q475 570 560 500" fill="none" stroke="#151225" stroke-width="26" stroke-linecap="round"/>`,
    `<circle cx="480" cy="420" r="270" fill="${b}"/><path d="M330 260 L410 115 L460 295 Z M500 285 L565 105 L635 300 Z" fill="${c}"/><circle cx="390" cy="410" r="38" fill="#151225"/><circle cx="555" cy="410" r="38" fill="#151225"/>`,
    `<rect x="190" y="250" width="580" height="320" rx="58" fill="${b}" transform="rotate(-7 480 410)"/><circle cx="340" cy="590" r="95" fill="#191629"/><circle cx="650" cy="550" r="95" fill="#191629"/><path d="M255 330 H680" stroke="${c}" stroke-width="42" stroke-linecap="round"/>`,
  ][scene % 3];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 820"><defs><radialGradient id="g"><stop stop-color="${a}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs><rect width="960" height="820" fill="url(#g)"/><circle cx="770" cy="145" r="170" fill="#fff" opacity=".12"/>${shapes}<text x="62" y="745" fill="#fff" font-family="Arial" font-size="54" font-weight="900">${safeTitle}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const productSeeds = [
  { slug: 'pocket-worlds-starter-set', name: 'Pocket Worlds Starter Set', category: 'Pocket Worlds', price: 34, originalPrice: 42, badge: 'Offer', colors: ['#ffad32', '#ff5f45', '#79233b'], description: 'A pocket-sized world packed with characters, moving pieces, and a story that grows every time you open it.', options: [{ name: 'Color', values: [{ label: 'Coral', color: '#ff5f45' }, { label: 'Lagoon', color: '#43c9d7' }] }, { name: 'Edition', values: [{ label: 'Starter' }, { label: 'Deluxe', priceDelta: 12 }] }] },
  { slug: 'odd-pals-plush', name: 'Odd Pals Plush', category: 'Plush', price: 28, badge: 'Best Seller', colors: ['#d95ad1', '#8af06d', '#4d1760'], description: 'Soft, wonderfully strange, and full of personality. Each Odd Pal arrives with its own collectible character card.', options: [{ name: 'Character', values: [{ label: 'Milo', color: '#8af06d' }, { label: 'Fizz', color: '#e879d8' }, { label: 'Bop', color: '#ffbf45' }] }] },
  { slug: 'tiny-table-bake-studio', name: 'Tiny Table Bake Studio', category: 'Creative Play', price: 39, originalPrice: 49, badge: 'Limited', colors: ['#ffd0dc', '#fff0c5', '#a63b68'], description: 'Mix, shape, and display tiny creations with a complete miniature bake studio made for inventive hands.', options: [{ name: 'Set', values: [{ label: 'Classic' }, { label: 'Party', priceDelta: 8 }] }] },
  { slug: 'neon-racers-twin-pack', name: 'Neon Racers Twin Pack', category: 'Action', price: 31, badge: 'New', colors: ['#182045', '#1fd8f2', '#ff275f'], description: 'Two quick-launch racers with luminous details, interchangeable shells, and track-ready energy.', options: [{ name: 'Color', values: [{ label: 'Electric Blue', color: '#1fd8f2' }, { label: 'Signal Red', color: '#ff275f' }] }] },
  { slug: 'bloom-pets-surprise-pod', name: 'Bloom Pets Surprise Pod', category: 'Surprise', price: 22, badge: 'Popular', colors: ['#f1a1e5', '#9ce6dd', '#ffd056'], description: 'Water the pod, watch it bloom, and discover a tiny pet with accessories hidden inside.', options: [] },
  { slug: 'splash-lab-water-blaster', name: 'Splash Lab Water Blaster', category: 'Outdoor', price: 46, colors: ['#25c8e8', '#ffea4a', '#1460aa'], description: 'A quick-fill water blaster engineered for long-range summer play and easy refills.', availability: 'Low stock', options: [{ name: 'Size', values: [{ label: 'Compact' }, { label: 'Max', priceDelta: 14 }] }] },
  { slug: 'build-club-maker-kit', name: 'Build Club Maker Kit', category: 'Creative Play', price: 44, badge: 'Best Seller', colors: ['#ff8349', '#ffd242', '#824229'], description: 'Snap, spin, and rebuild 120 colorful parts into machines, creatures, and anything else you imagine.', options: [] },
  { slug: 'cloud-dough-color-pack', name: 'Cloud Dough Color Pack', category: 'Sensory', price: 18, originalPrice: 24, badge: 'Offer', colors: ['#819dff', '#ef9fe3', '#473d92'], description: 'Six airy colors with a soft stretch and clean finish, packed in reusable mixing pots.', availability: 'In stock', options: [{ name: 'Palette', values: [{ label: 'Dream', color: '#ef9fe3' }, { label: 'Ocean', color: '#38bad5' }] }] },
];

export const productCategories = [
  { id: 'all', slug: 'all', nameEn: 'All Products', nameAr: 'كل المنتجات', name: { en: 'All Products', ar: 'كل المنتجات' } },
  {
    id: 'pocket-worlds', slug: 'pocket-worlds', nameEn: 'Pocket Worlds', nameAr: 'عوالم الجيب', name: { en: 'Pocket Worlds', ar: 'عوالم الجيب' },
    heroImage: '/media/poster-about.jpg', descriptionEn: 'Tiny doors open into enormous stories, collectible characters, and play that travels anywhere.', descriptionAr: 'أبواب صغيرة تفتح على قصص كبيرة وشخصيات قابلة للجمع ولعب يرافقك أينما ذهبت.',
    home: { order: 1, kickerEn: 'Big stories. Tiny scale.', kickerAr: 'قصص كبيرة بحجم صغير.', palette: ['#ff7c28', '#ffcf45', '#8f281d'], scene: 'mini' },
  },
  {
    id: 'plush', slug: 'plush', nameEn: 'Plush', nameAr: 'ألعاب محشوة', name: { en: 'Plush', ar: 'ألعاب محشوة' },
    heroImage: '/media/poster-news.jpg', descriptionEn: 'Soft characters with curious personalities, made for comfort, collecting, and everyday adventures.', descriptionAr: 'شخصيات ناعمة بطباع فضولية، صُممت للراحة والجمع والمغامرات اليومية.',
    home: { order: 2, kickerEn: 'Perfectly strange friends.', kickerAr: 'أصدقاء رائعون بغرابتهم.', palette: ['#a935b2', '#ff6ea9', '#4b1663'], scene: 'pals' },
  },
  {
    id: 'creative-play', slug: 'creative-play', nameEn: 'Creative Play', nameAr: 'لعب إبداعي', name: { en: 'Creative Play', ar: 'لعب إبداعي' },
    heroImage: '/media/poster-about.jpg', descriptionEn: 'Make, mix, build, and begin again with open-ended sets designed for inventive hands.', descriptionAr: 'اصنع وامزج وابنِ وابدأ من جديد مع مجموعات مفتوحة صُممت للأيدي المبدعة.',
    home: { order: 3, kickerEn: 'Make every little moment.', kickerAr: 'اصنع كل لحظة صغيرة.', palette: ['#ffb6c8', '#f6e6ce', '#a73b68'], scene: 'table' },
  },
  {
    id: 'action', slug: 'action', nameEn: 'Action', nameAr: 'حركة ومغامرة', name: { en: 'Action', ar: 'حركة ومغامرة' },
    heroImage: '/media/poster-contact.jpg', descriptionEn: 'Fast launches, bold challenges, and kinetic play built to keep every round moving.', descriptionAr: 'انطلاقات سريعة وتحديات جريئة ولعب حركي يبقي كل جولة مستمرة.',
    home: { order: 4, kickerEn: 'Energy in your hands.', kickerAr: 'الطاقة بين يديك.', palette: ['#121a3b', '#00c3ff', '#ff225c'], scene: 'race' },
  },
  {
    id: 'surprise', slug: 'surprise', nameEn: 'Surprise', nameAr: 'مفاجآت', name: { en: 'Surprise', ar: 'مفاجآت' },
    heroImage: '/media/poster-about.jpg', descriptionEn: 'Layers of discovery, bright reveals, and collectible moments made to be shared.', descriptionAr: 'طبقات من الاكتشاف ومفاجآت مبهجة ولحظات قابلة للجمع والمشاركة.',
    home: { order: 5, kickerEn: 'Surprise lives inside.', kickerAr: 'المفاجأة في الداخل.', palette: ['#f39be5', '#9ce6dd', '#ffd056'], scene: 'bloom' },
  },
  { id: 'outdoor', slug: 'outdoor', nameEn: 'Outdoor', nameAr: 'ألعاب خارجية', name: { en: 'Outdoor', ar: 'ألعاب خارجية' }, heroImage: '/media/poster-contact.jpg', descriptionEn: 'Big-energy play made for sunny days, open spaces, and friendly competition.', descriptionAr: 'لعب مليء بالطاقة للأيام المشمسة والمساحات المفتوحة والمنافسة الودية.' },
  { id: 'sensory', slug: 'sensory', nameEn: 'Sensory', nameAr: 'ألعاب حسية', name: { en: 'Sensory', ar: 'ألعاب حسية' }, heroImage: '/media/poster-news.jpg', descriptionEn: 'Color, texture, and calming hands-on play that rewards curiosity.', descriptionAr: 'ألوان وملامس ولعب عملي هادئ يكافئ الفضول.' },
];

export const homeCategories = productCategories.filter((category) => category.home).sort((a, b) => a.home.order - b.home.order);

const categoryIdByName = Object.fromEntries(productCategories.map((category) => [category.name.en, category.id]));
const arabicDescriptions = [
  'عالم صغير مليء بالشخصيات والقطع المتحركة وقصة تكبر في كل مرة تفتحه فيها.',
  'رفيق ناعم وغريب بطريقة محببة، يتمتع بشخصية مميزة ويأتي مع بطاقة شخصية قابلة للجمع.',
  'امزج وشكّل واعرض إبداعاتك الصغيرة مع استوديو خبز مصغّر متكامل للأيدي المبدعة.',
  'سيارتان سريعتان بتفاصيل مضيئة وهياكل قابلة للتبديل وطاقة جاهزة للسباق.',
  'اسقِ الكبسولة وشاهدها تتفتح لتكتشف حيواناً صغيراً وإكسسوارات مخفية في الداخل.',
  'قاذف مياه سريع التعبئة مصمم للعب الصيفي بعيد المدى وإعادة التعبئة بسهولة.',
  'ركّب وحرّك وأعد بناء 120 قطعة ملوّنة لصنع آلات ومخلوقات وكل ما تتخيله.',
  'ستة ألوان خفيفة ومرنة بملمس ناعم، محفوظة في عبوات قابلة لإعادة الاستخدام.',
];
const optionArabic = { Color: 'اللون', Edition: 'الإصدار', Character: 'الشخصية', Set: 'المجموعة', Size: 'الحجم', Palette: 'لوحة الألوان' };
const valueArabic = { Coral: 'مرجاني', Lagoon: 'بحيري', Starter: 'أساسي', Deluxe: 'فاخر', Milo: 'ميلو', Fizz: 'فيز', Bop: 'بوب', Classic: 'كلاسيكي', Party: 'حفلات', 'Electric Blue': 'أزرق كهربائي', 'Signal Red': 'أحمر لامع', Compact: 'مدمج', Max: 'كبير', Dream: 'حالم', Ocean: 'محيطي' };
const badgeArabic = { Offer: 'عرض', 'Best Seller': 'الأكثر مبيعاً', Limited: 'إصدار محدود', New: 'جديد', Popular: 'رائج' };
const availabilityArabic = { 'In stock': 'متوفر', 'Low stock': 'كمية محدودة', 'Out of stock': 'غير متوفر' };

export const products = productSeeds.map((seed, index) => {
  const image = artwork(seed.name, seed.colors, index);
  const hoverImage = artwork(seed.name, [seed.colors[1], seed.colors[2], seed.colors[0]], index + 1);
  const detailImage = artwork(seed.name, [seed.colors[2], seed.colors[0], seed.colors[1]], index + 2);
  const options = (seed.options || []).map((option) => ({
    ...option,
    nameAr: optionArabic[option.name] || option.name,
    values: option.values.map((value, valueIndex) => ({ ...value, labelAr: valueArabic[value.label] || value.label, image: value.color ? artwork(seed.name, [value.color, seed.colors[1], seed.colors[2]], index + valueIndex) : undefined })),
  }));
  const categoryId = categoryIdByName[seed.category];
  const categorySlug = productCategories.find((category) => category.id === categoryId)?.slug;
  return {
    id: `play-${index + 1}`,
    shortDescription: seed.description.split('.')[0] + '.',
    availability: seed.availability || 'In stock',
    availabilityAr: availabilityArabic[seed.availability || 'In stock'],
    categoryId,
    categorySlug,
    descriptionAr: arabicDescriptions[index],
    shortDescriptionAr: arabicDescriptions[index].split('.')[0] + '.',
    badgeAr: badgeArabic[seed.badge] || seed.badge,
    ...seed,
    image,
    hoverImage,
    gallery: [image, hoverImage, detailImage],
    options,
  };
});

export const getCategoryBySlug = (slug) => productCategories.find((category) => category.slug === slug) || productCategories[0];
export const getProductsByCategory = (categoryId) => products.filter((product) => product.categoryId === categoryId);
export const getCategoryLabel = (categoryId, locale) => productCategories.find((category) => category.id === categoryId)?.name[locale] || '';
export const getProductName = (product, locale) => (locale === 'ar' ? (product.nameAr || product.name) : product.name) || '';
export const getProductDescription = (product, locale, short = false) => locale === 'ar' ? (short ? product.shortDescriptionAr : product.descriptionAr) : (short ? product.shortDescription : product.description);
export const getProductBadge = (product, locale) => locale === 'ar' ? product.badgeAr : product.badge;
export const getAvailability = (product, locale) => locale === 'ar' ? product.availabilityAr : product.availability;
export const getOptionName = (option, locale) => locale === 'ar' ? option.nameAr : option.name;
export const getOptionValue = (value, locale) => locale === 'ar' ? value.labelAr : value.label;
export const getProductBySlug = (slug) => products.find((product) => product.slug === slug);
