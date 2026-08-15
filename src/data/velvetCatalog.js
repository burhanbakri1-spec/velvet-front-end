// ===========================================================================
// VELVET catalog — centralized temporary data layer.
//
// VELVET is a GROUP / parent company. Under VELVET there are internal brands
// (VELVET BABY, VELVET KIDS, …). Each brand owns a category tree:
//
//   VELVET Group
//   → Brand            (internal VELVET family / play experience)
//   → Main Category
//   → Subcategory
//   → Products
//
// A product may additionally carry an external Product Brand / Manufacturer
// (Fisher-Price, Mattel, Hasbro, Disney, …). That dimension is kept separate
// from the internal VELVET brand — never mix the two.
//
// This module is the single source of truth for the hierarchy + filters and is
// designed to be replaced later by an API/database. The raw tree mirrors
// reference/velvet-menu-demo/index.html (logic only; the visual design comes
// from the existing site). Existing real products from ./products.js are merged
// in and receive VELVET attributes; every remaining leaf is seeded with a
// deterministic placeholder product so the full hierarchy is navigable.
//
// Filter logic (documented): selections inside one group are OR; groups are
// ANDed. Category path (brand + category + subcategory + manufacturer) is ANDed
// with every selected filter group.
// ===========================================================================

import { artwork, products } from './products.js';
import { getPlatformMedia } from './platformContent.js';

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// ---------------------------------------------------------------------------
// Brand tree (names + colors adapted from the reference demo).
// ---------------------------------------------------------------------------
const RAW_BRANDS = [
  {
    id: 'baby', name: { ar: 'VELVET BABY', en: 'VELVET BABY' }, short: { ar: 'بيبي', en: 'Baby' },
    tagline: { ar: 'ألعاب الرضع والأطفال الصغار', en: 'Baby & Toddler' }, color: '#7ec8a3',
    productBrands: ['Fisher-Price', 'VTech', 'Chicco', 'Infantino', 'Other'],
    categories: [
      { name: { ar: 'تنمية الطفل', en: 'Baby Development' }, subs: [
        { ar: 'ألعاب حسية', en: 'Sensory Toys' }, { ar: 'المهارات الحركية الدقيقة', en: 'Fine Motor' },
        { ar: 'ألعاب الإدراك', en: 'Cognitive Toys' }, { ar: 'ألعاب تنموية', en: 'Developmental Toys' },
      ] },
      { name: { ar: 'خشخيشات وعضاضات', en: 'Rattles & Teethers' }, subs: [
        { ar: 'خشخيشات', en: 'Rattles' }, { ar: 'عضاضات', en: 'Teethers' }, { ar: 'ألعاب قبض', en: 'Grasping Toys' },
      ] },
      { name: { ar: 'أنشطة الأطفال', en: 'Baby Activity' }, subs: [
        { ar: 'مراكز نشاط', en: 'Activity Centers' }, { ar: 'مكعبات نشاط', en: 'Activity Cubes' },
        { ar: 'جيم بيبي', en: 'Baby Gyms' }, { ar: 'سجاد لعب', en: 'Play Mats' },
      ] },
      { name: { ar: 'التكدس والفرز', en: 'Stacking & Sorting' }, subs: [
        { ar: 'حلقات تكدس', en: 'Stacking Rings' }, { ar: 'ألعاب فرز', en: 'Sorting Toys' },
        { ar: 'فرازات أشكال', en: 'Shape Sorters' }, { ar: 'تداخل', en: 'Nesting Toys' },
      ] },
      { name: { ar: 'الدفع والسحب', en: 'Push & Pull' }, subs: [
        { ar: 'دفع', en: 'Push Toys' }, { ar: 'سحب', en: 'Pull Toys' }, { ar: 'مشي', en: 'Walking Toys' },
      ] },
      { name: { ar: 'ألعاب موسيقية', en: 'Musical Baby Toys' }, subs: [
        { ar: 'آلات', en: 'Baby Instruments' }, { ar: 'موسيقية', en: 'Musical Toys' }, { ar: 'صوت', en: 'Sound Toys' },
      ] },
      { name: { ar: 'ألعاب الاستحمام', en: 'Bath Toys' }, subs: [
        { ar: 'حيوانات', en: 'Bath Animals' }, { ar: 'كتب استحمام', en: 'Bath Books' }, { ar: 'لعب مائي', en: 'Water Play' },
      ] },
      { name: { ar: 'دمى ناعمة للرضع', en: 'Baby Plush' }, subs: [
        { ar: 'ناعمة', en: 'Soft Toys' }, { ar: 'راحة', en: 'Comfort Toys' }, { ar: 'بطانيات أمان', en: 'Security Blankets' },
      ] },
      { name: { ar: 'أول مركبات الطفل', en: 'First Vehicles' }, subs: [
        { ar: 'ركوب', en: 'Baby Ride-ons' }, { ar: 'مشايات', en: 'Walkers' }, { ar: 'سيارات دفع', en: 'Push Cars' },
      ] },
      { name: { ar: 'كتب الأطفال', en: 'Baby Books' }, subs: [
        { ar: 'قماش', en: 'Cloth Books' }, { ar: 'استحمام', en: 'Bath Books' },
        { ar: 'مقواة', en: 'Board Books' }, { ar: 'صوت', en: 'Sound Books' },
      ] },
    ],
  },
  {
    id: 'kids', name: { ar: 'VELVET KIDS', en: 'VELVET KIDS' }, short: { ar: 'كيدز', en: 'Kids' },
    tagline: { ar: 'ألعاب الأطفال العامة', en: 'Kids Toys' }, color: '#f0b27a',
    productBrands: ['Hasbro', 'Mattel', 'Disney', 'Spin Master', 'Other'],
    categories: [
      { name: { ar: 'ما قبل المدرسة', en: 'Preschool Toys' }, subs: [
        { ar: 'تعلم', en: 'Learning Toys' }, { ar: 'نشاط', en: 'Activity Toys' }, { ar: 'تفاعلي', en: 'Interactive Toys' },
      ] },
      { name: { ar: 'ألعاب الأطفال', en: 'Kids Toys' }, subs: [
        { ar: 'شخصيات', en: 'Character Toys' }, { ar: 'تفاعلي', en: 'Interactive Toys' }, { ar: 'ترفيهي', en: 'Novelty Toys' },
      ] },
      { name: { ar: 'شخصيات وأبطال', en: 'Action Figures' }, subs: [
        { ar: 'أبطال', en: 'Superheroes' }, { ar: 'شخصيات', en: 'Characters' }, { ar: 'خيال', en: 'Fantasy Figures' },
      ] },
      { name: { ar: 'المركبات', en: 'Vehicles' }, subs: [
        { ar: 'سيارات', en: 'Cars' }, { ar: 'شاحنات', en: 'Trucks' }, { ar: 'طائرات', en: 'Planes' },
        { ar: 'قطارات', en: 'Trains' }, { ar: 'قوارب', en: 'Boats' },
      ] },
      { name: { ar: 'الروبوتات', en: 'Robots' }, subs: [
        { ar: 'تحكم عن بعد', en: 'Remote Control' }, { ar: 'تفاعلي', en: 'Interactive' }, { ar: 'تعليمي', en: 'Educational' },
      ] },
      { name: { ar: 'إلكترونيات الأطفال', en: 'Kids Electronics' }, subs: [
        { ar: 'كاميرات', en: 'Cameras' }, { ar: 'ذكية', en: 'Smart Toys' }, { ar: 'ألعاب إلكترونية', en: 'Electronic Games' },
      ] },
      { name: { ar: 'ألعاب موسيقية', en: 'Music Toys' }, subs: [
        { ar: 'كيبورد', en: 'Keyboards' }, { ar: 'طبول', en: 'Drums' }, { ar: 'جيتار', en: 'Guitars' }, { ar: 'مايك', en: 'Microphones' },
      ] },
      { name: { ar: 'ترفيهية متنوعة', en: 'Novelty Toys' }, subs: [
        { ar: 'فيدجيت', en: 'Fidget' }, { ar: 'مفاجآت', en: 'Surprise Toys' }, { ar: 'تفاعلي متنوع', en: 'Interactive Novelties' },
      ] },
    ],
  },
  {
    id: 'play', name: { ar: 'VELVET PLAY', en: 'VELVET PLAY' }, short: { ar: 'بلاي', en: 'Play' },
    tagline: { ar: 'التمثيل والخيال', en: 'Pretend Play & Imagination' }, color: '#e8a0bf',
    productBrands: ['Barbie', 'Baby Born', 'Our Generation', 'Disney', 'Playmobil', 'Other'],
    categories: [
      { name: { ar: 'الدمى', en: 'Dolls' }, subs: [
        { ar: 'بيبي', en: 'Baby Dolls' }, { ar: 'موضة', en: 'Fashion Dolls' },
        { ar: 'تفاعلية', en: 'Interactive Dolls' }, { ar: 'شخصيات', en: 'Character Dolls' },
      ] },
      { name: { ar: 'بيوت الدمى', en: 'Dollhouses' }, subs: [
        { ar: 'بيوت', en: 'Dollhouses' }, { ar: 'أثاث', en: 'Doll Furniture' },
        { ar: 'غرف', en: 'Doll Rooms' }, { ar: 'إكسسوارات', en: 'Accessories' },
      ] },
      { name: { ar: 'ألعاب المطابخ', en: 'Kitchen Play' }, subs: [
        { ar: 'مطابخ', en: 'Toy Kitchens' }, { ar: 'مجموعات', en: 'Kitchen Sets' },
        { ar: 'طبخ', en: 'Cooking Accessories' }, { ar: 'طعام', en: 'Food Sets' },
      ] },
      { name: { ar: 'ألعاب المنزل', en: 'Home Play' }, subs: [
        { ar: 'تنظيف', en: 'Cleaning Sets' }, { ar: 'غسيل', en: 'Laundry' }, { ar: 'منزل', en: 'Household Sets' },
      ] },
      { name: { ar: 'المتجر والسوق', en: 'Shop & Market' }, subs: [
        { ar: 'سوبرماركت', en: 'Supermarket' }, { ar: 'كاشير', en: 'Cash Registers' },
        { ar: 'عربات', en: 'Shopping Carts' }, { ar: 'طعام', en: 'Food Sets' },
      ] },
      { name: { ar: 'الطبيب والطب', en: 'Doctor & Medical' }, subs: [
        { ar: 'طبيب', en: 'Doctor Sets' }, { ar: 'أسنان', en: 'Dentist Sets' },
        { ar: 'طبية', en: 'Medical Kits' }, { ar: 'مستشفى', en: 'Hospital Play' },
      ] },
      { name: { ar: 'التجميل والصالون', en: 'Beauty & Salon' }, subs: [
        { ar: 'شعر', en: 'Hairdresser' }, { ar: 'مكياج', en: 'Makeup Play' }, { ar: 'أظافر', en: 'Nail Sets' },
      ] },
      { name: { ar: 'الأدوات والورش', en: 'Tools & Workshop' }, subs: [
        { ar: 'أدوات', en: 'Tool Sets' }, { ar: 'ورش', en: 'Workbenches' }, { ar: 'بناء أدوار', en: 'Construction Role Play' },
      ] },
      { name: { ar: 'الشرطة والطوارئ', en: 'Police & Emergency' }, subs: [
        { ar: 'شرطة', en: 'Police' }, { ar: 'إطفاء', en: 'Firefighter' },
        { ar: 'إنقاذ', en: 'Rescue' }, { ar: 'إسعاف', en: 'Ambulance' },
      ] },
      { name: { ar: 'الأزياء التنكرية', en: 'Costumes & Dress Up' }, subs: [
        { ar: 'أميرة', en: 'Princess' }, { ar: 'بطل', en: 'Superhero' }, { ar: 'طبيب', en: 'Doctor' },
        { ar: 'شرطة', en: 'Police' }, { ar: 'حيوانات', en: 'Animals' }, { ar: 'خيال', en: 'Fantasy' },
      ] },
      { name: { ar: 'الدمى المتحركة', en: 'Puppets' }, subs: [
        { ar: 'يد', en: 'Hand Puppets' }, { ar: 'أصابع', en: 'Finger Puppets' }, { ar: 'مجموعات', en: 'Puppet Sets' },
      ] },
      { name: { ar: 'اللعب الخيالي', en: 'Fantasy Play' }, subs: [
        { ar: 'جنيات', en: 'Fairies' }, { ar: 'سحر', en: 'Magic' },
        { ar: 'فرسان', en: 'Knights' }, { ar: 'تنين', en: 'Dragons' },
      ] },
      { name: { ar: 'الخيم وبيوت اللعب', en: 'Tents & Playhouses' }, subs: [
        { ar: 'خيم', en: 'Play Tents' }, { ar: 'بيوت', en: 'Playhouses' }, { ar: 'أنفاق', en: 'Tunnels' },
      ] },
      { name: { ar: 'مجموعات الأدوار', en: 'Role Play Sets' }, subs: [
        { ar: 'مهن', en: 'Occupation Sets' }, { ar: 'شخصيات', en: 'Character Sets' }, { ar: 'مغامرة', en: 'Adventure Sets' },
      ] },
    ],
  },
  {
    id: 'build', name: { ar: 'VELVET BUILD', en: 'VELVET BUILD' }, short: { ar: 'بيلد', en: 'Build' },
    tagline: { ar: 'البناء والتركيب', en: 'Construction & Building' }, color: '#7eb6d9',
    productBrands: ['LEGO', 'Playmobil', 'MEGA', 'Magna-Tiles', 'Plus-Plus', 'Other'],
    categories: [
      { name: { ar: 'مكعبات البناء', en: 'Building Blocks' }, subs: [
        { ar: 'كلاسيك', en: 'Classic Blocks' }, { ar: 'كبيرة', en: 'Large Blocks' }, { ar: 'مصغرة', en: 'Mini Blocks' },
      ] },
      { name: { ar: 'مجموعات الطوب', en: 'Brick Sets' }, subs: [
        { ar: 'بناء', en: 'Construction Sets' }, { ar: 'شخصيات', en: 'Character Sets' }, { ar: 'ثيمات', en: 'Themed Sets' },
      ] },
      { name: { ar: 'البناء المغناطيسي', en: 'Magnetic Building' }, subs: [
        { ar: 'بلاط', en: 'Magnetic Tiles' }, { ar: 'مكعبات', en: 'Magnetic Blocks' }, { ar: 'عصي', en: 'Magnetic Sticks' },
      ] },
      { name: { ar: 'ليجو وطوب', en: 'LEGO & Bricks' }, subs: [
        { ar: 'LEGO Sets', en: 'LEGO Sets' }, { ar: 'Technic', en: 'LEGO Technic' }, { ar: 'City', en: 'LEGO City' },
        { ar: 'Friends', en: 'LEGO Friends' }, { ar: 'Architecture', en: 'LEGO Architecture' },
      ] },
      { name: { ar: 'البناء الخشبي', en: 'Wooden Building' }, subs: [
        { ar: 'مكعبات خشب', en: 'Wooden Blocks' }, { ar: 'تركيب خشبي', en: 'Wooden Construction' },
      ] },
      { name: { ar: 'مجموعات الهندسة', en: 'Engineering Sets' }, subs: [
        { ar: 'ميكانيكي', en: 'Mechanical Sets' }, { ar: 'هندسة', en: 'Engineering Kits' }, { ar: 'آلات', en: 'Machine Building' },
      ] },
      { name: { ar: 'العمارة', en: 'Architecture' }, subs: [
        { ar: 'مباني', en: 'Buildings' }, { ar: 'معالم', en: 'Landmarks' },
        { ar: 'مدن', en: 'Cities' }, { ar: 'إسلامي', en: 'Islamic Architecture' },
      ] },
      { name: { ar: 'مسارات الكرات', en: 'Marble Runs' }, subs: [
        { ar: 'مسارات', en: 'Marble Tracks' }, { ar: 'كرات', en: 'Ball Runs' }, { ar: 'مجموعات', en: 'Track Sets' },
      ] },
      { name: { ar: 'تركيب المجسمات', en: 'Model Building' }, subs: [
        { ar: 'سيارات', en: 'Cars' }, { ar: 'طائرات', en: 'Aircraft' },
        { ar: 'سفن', en: 'Ships' }, { ar: 'مباني', en: 'Buildings' },
      ] },
      { name: { ar: 'بناء الروبوتات', en: 'Robotics Building' }, subs: [
        { ar: 'كيت', en: 'Robot Kits' }, { ar: 'ميكانيكي', en: 'Mechanical Robots' }, { ar: 'قابل للبرمجة', en: 'Programmable' },
      ] },
      { name: { ar: 'بناء ثلاثي الأبعاد', en: '3D Construction' }, subs: [
        { ar: 'نماذج', en: '3D Models' }, { ar: 'بازل', en: '3D Puzzles' }, { ar: 'بناء', en: '3D Building' },
      ] },
    ],
  },
  {
    id: 'learn', name: { ar: 'VELVET LEARN', en: 'VELVET LEARN' }, short: { ar: 'ليرن', en: 'Learn' },
    tagline: { ar: 'التعليم والذكاء', en: 'Educational, STEM & Montessori' }, color: '#a8d08d',
    productBrands: ['Montessori', 'Learning Resources', 'Thames & Kosmos', 'Osmo', 'Other'],
    categories: [
      { name: { ar: 'التعلم المبكر', en: 'Early Learning' }, subs: [
        { ar: 'حروف', en: 'Alphabet' }, { ar: 'أرقام', en: 'Numbers' },
        { ar: 'ألوان', en: 'Colors' }, { ar: 'أشكال', en: 'Shapes' },
      ] },
      { name: { ar: 'القراءة والكتابة', en: 'Reading & Writing' }, subs: [
        { ar: 'حروف', en: 'Letters' }, { ar: 'صوتيات', en: 'Phonics' },
        { ar: 'كتابة', en: 'Writing' }, { ar: 'قراءة', en: 'Reading' },
      ] },
      { name: { ar: 'تعلم الرياضيات', en: 'Math Learning' }, subs: [
        { ar: 'عد', en: 'Counting' }, { ar: 'جمع', en: 'Addition' },
        { ar: 'ضرب', en: 'Multiplication' }, { ar: 'هندسة', en: 'Geometry' },
      ] },
      { name: { ar: 'مونتيسوري', en: 'Montessori' }, subs: [
        { ar: 'حياة عملية', en: 'Practical Life' }, { ar: 'فرز', en: 'Sorting' },
        { ar: 'مطابقة', en: 'Matching' }, { ar: 'دقيقة', en: 'Fine Motor' },
      ] },
      { name: { ar: 'STEM', en: 'STEM' }, subs: [
        { ar: 'كيت', en: 'STEM Kits' }, { ar: 'هندسة', en: 'Engineering' },
        { ar: 'تقنية', en: 'Technology' }, { ar: 'رياضيات', en: 'Mathematics' },
      ] },
      { name: { ar: 'العلوم', en: 'Science' }, subs: [
        { ar: 'كيمياء', en: 'Chemistry' }, { ar: 'فيزياء', en: 'Physics' },
        { ar: 'أحياء', en: 'Biology' }, { ar: 'تجارب', en: 'Experiments' },
      ] },
      { name: { ar: 'روبوتات وبرمجة', en: 'Robotics & Coding' }, subs: [
        { ar: 'كودينج', en: 'Coding Toys' }, { ar: 'روبوت', en: 'Robot Kits' }, { ar: 'برمجة', en: 'Programming' },
      ] },
      { name: { ar: 'الاستكشاف', en: 'Discovery' }, subs: [
        { ar: 'فضاء', en: 'Space' }, { ar: 'ديناصورات', en: 'Dinosaurs' },
        { ar: 'طبيعة', en: 'Nature' }, { ar: 'حيوانات', en: 'Animals' },
      ] },
      { name: { ar: 'الجغرافيا', en: 'Geography' }, subs: [
        { ar: 'خرائط', en: 'Maps' }, { ar: 'كرات', en: 'Globes' },
        { ar: 'دول', en: 'Countries' }, { ar: 'قارات', en: 'Continents' },
      ] },
      { name: { ar: 'المنطق والذكاء', en: 'Logic & IQ' }, subs: [
        { ar: 'IQ', en: 'IQ Games' }, { ar: 'منطق', en: 'Logic Games' }, { ar: 'حل مشكلات', en: 'Problem Solving' },
      ] },
      { name: { ar: 'الذاكرة والتركيز', en: 'Memory & Concentration' }, subs: [
        { ar: 'ذاكرة', en: 'Memory Games' }, { ar: 'مطابقة', en: 'Matching' }, { ar: 'تركيز', en: 'Concentration' },
      ] },
      { name: { ar: 'الحقائب التعليمية', en: 'Educational Kits' }, subs: [
        { ar: 'نشاط', en: 'Activity Kits' }, { ar: 'تعلم', en: 'Learning Kits' }, { ar: 'تجارب', en: 'Experiment Kits' },
      ] },
    ],
  },
  {
    id: 'create', name: { ar: 'VELVET CREATE', en: 'VELVET CREATE' }, short: { ar: 'كريت', en: 'Create' },
    tagline: { ar: 'الفن والإبداع', en: 'Arts, Crafts & DIY' }, color: '#f2c14e',
    productBrands: ['Crayola', 'Play-Doh', 'Klutz', 'Make It Real', 'Other'],
    categories: [
      { name: { ar: 'الرسم', en: 'Drawing' }, subs: [
        { ar: 'مجموعات', en: 'Drawing Sets' }, { ar: 'أقلام', en: 'Pencils' },
        { ar: 'ماركر', en: 'Markers' }, { ar: 'ألوان شمع', en: 'Crayons' },
      ] },
      { name: { ar: 'التلوين', en: 'Coloring' }, subs: [
        { ar: 'كتب', en: 'Coloring Books' }, { ar: 'كيت', en: 'Coloring Kits' }, { ar: 'رقم', en: 'Paint-by-Number' },
      ] },
      { name: { ar: 'الرسم بالألوان', en: 'Painting' }, subs: [
        { ar: 'مجموعات', en: 'Paint Sets' }, { ar: 'مائي', en: 'Watercolors' },
        { ar: 'أكريليك', en: 'Acrylic' }, { ar: 'حوامل', en: 'Easels' },
      ] },
      { name: { ar: 'الصلصال والتشكيل', en: 'Clay & Modeling' }, subs: [
        { ar: 'صلصال', en: 'Modeling Clay' }, { ar: 'عجين', en: 'Play Dough' }, { ar: 'أدوات', en: 'Modeling Tools' },
      ] },
      { name: { ar: 'أشغال يدوية', en: 'Crafts' }, subs: [
        { ar: 'كيت', en: 'Craft Kits' }, { ar: 'ورق', en: 'Paper Crafts' }, { ar: 'فوم', en: 'Foam Crafts' },
      ] },
      { name: { ar: 'صناعة الإكسسوارات', en: 'Jewelry Making' }, subs: [
        { ar: 'أساور', en: 'Bracelet Making' }, { ar: 'خرز', en: 'Beads' }, { ar: 'كيت', en: 'Jewelry Kits' },
      ] },
      { name: { ar: 'اصنع بنفسك', en: 'DIY' }, subs: [
        { ar: 'كيت', en: 'DIY Kits' }, { ar: 'اصنع', en: 'Make & Create' }, { ar: 'زيّن', en: 'Build & Decorate' },
      ] },
      { name: { ar: 'إبداع علمي', en: 'Science Crafts' }, subs: [
        { ar: 'كريستال', en: 'Crystal Kits' }, { ar: 'سلايم', en: 'Slime' }, { ar: 'تجارب', en: 'Experiments' },
      ] },
      { name: { ar: 'خياطة ونسيج', en: 'Sewing & Textile' }, subs: [
        { ar: 'خياطة', en: 'Sewing Kits' }, { ar: 'حياكة', en: 'Knitting' }, { ar: 'نسيج', en: 'Textile Crafts' },
      ] },
      { name: { ar: 'طبخ الأطفال', en: 'Kids Cooking' }, subs: [
        { ar: 'خبز', en: 'Baking Kits' }, { ar: 'طبخ', en: 'Cooking Sets' }, { ar: 'تزيين', en: 'Decorating Kits' },
      ] },
      { name: { ar: 'فن الرمل', en: 'Sand Art' }, subs: [
        { ar: 'رسم رمل', en: 'Sand Painting' }, { ar: 'ملون', en: 'Colored Sand' }, { ar: 'كيت', en: 'Sand Kits' },
      ] },
      { name: { ar: 'مجموعات أنشطة', en: 'Activity Kits' }, subs: [
        { ar: 'إبداع', en: 'Creative Kits' }, { ar: 'صناديق', en: 'Activity Boxes' }, { ar: 'مشاريع', en: 'Project Kits' },
      ] },
    ],
  },
  {
    id: 'games', name: { ar: 'VELVET GAMES', en: 'VELVET GAMES' }, short: { ar: 'جيمز', en: 'Games' },
    tagline: { ar: 'الألعاب والبازل', en: 'Games, Puzzles & Family' }, color: '#c9a0dc',
    productBrands: ['Ravensburger', 'Hasbro', 'Mattel Games', 'Exploding Kittens', 'Other'],
    categories: [
      { name: { ar: 'ألعاب الطاولة', en: 'Board Games' }, subs: [
        { ar: 'عائلي', en: 'Family' }, { ar: 'استراتيجية', en: 'Strategy' },
        { ar: 'تعليمي', en: 'Educational' }, { ar: 'تعاوني', en: 'Cooperative' },
      ] },
      { name: { ar: 'ألعاب الورق', en: 'Card Games' }, subs: [
        { ar: 'عائلي', en: 'Family Cards' }, { ar: 'استراتيجية', en: 'Strategy Cards' }, { ar: 'أطفال', en: "Children's Cards" },
      ] },
      { name: { ar: 'ألعاب الحفلات', en: 'Party Games' }, subs: [
        { ar: 'جماعي', en: 'Group Games' }, { ar: 'تحدي', en: 'Challenge Games' }, { ar: 'مضحك', en: 'Funny Games' },
      ] },
      { name: { ar: 'ألعاب عائلية', en: 'Family Games' }, subs: [
        { ar: 'طاولة عائلية', en: 'Family Board Games' }, { ar: 'تحديات', en: 'Family Challenges' },
      ] },
      { name: { ar: 'ألعاب استراتيجية', en: 'Strategy Games' }, subs: [
        { ar: 'استراتيجية', en: 'Strategy' }, { ar: 'تكتيكي', en: 'Tactical' }, { ar: 'تنافسي', en: 'Competitive' },
      ] },
      { name: { ar: 'كلاسيكية', en: 'Classic Games' }, subs: [
        { ar: 'شطرنج', en: 'Chess' }, { ar: 'داما', en: 'Checkers' },
        { ar: 'دومينو', en: 'Domino' }, { ar: 'طاولة', en: 'Backgammon' }, { ar: 'XO', en: 'XO' },
      ] },
      { name: { ar: 'البازل', en: 'Jigsaw Puzzles' }, subs: [
        { ar: 'أطفال', en: 'Kids Puzzles' }, { ar: 'بالغين', en: 'Adult Puzzles' }, { ar: 'ثلاثي', en: '3D Puzzles' },
      ] },
      { name: { ar: 'ألغاز الذكاء', en: 'Brain Puzzles' }, subs: [
        { ar: 'IQ', en: 'IQ' }, { ar: 'منطق', en: 'Logic' }, { ar: 'ميكانيكي', en: 'Mechanical' }, { ar: 'خشبي', en: 'Wooden' },
      ] },
      { name: { ar: 'ألعاب الذاكرة', en: 'Memory Games' }, subs: [
        { ar: 'ذاكرة', en: 'Memory' }, { ar: 'مطابقة', en: 'Matching' }, { ar: 'تركيز', en: 'Concentration' },
      ] },
      { name: { ar: 'مسابقات وأسئلة', en: 'Trivia & Quiz' }, subs: [
        { ar: 'كويز', en: 'Quiz' }, { ar: 'معلومات', en: 'Trivia' }, { ar: 'معرفة', en: 'Knowledge Games' },
      ] },
      { name: { ar: 'ألعاب خارجية جماعية', en: 'Outdoor Games' }, subs: [
        { ar: 'عملاقة', en: 'Giant Games' }, { ar: 'عائلي خارجي', en: 'Family Outdoor' },
      ] },
    ],
  },
  {
    id: 'move', name: { ar: 'VELVET MOVE', en: 'VELVET MOVE' }, short: { ar: 'موف', en: 'Move' },
    tagline: { ar: 'الحركة والرياضة', en: 'Outdoor, Sports & Active Play' }, color: '#6ec6c0',
    productBrands: ['Razor', 'Little Tikes', 'Intex', 'Sports Brands', 'Other'],
    categories: [
      { name: { ar: 'اللعب الخارجي', en: 'Outdoor Play' }, subs: [
        { ar: 'حديقة', en: 'Garden Toys' }, { ar: 'مجموعات', en: 'Outdoor Sets' },
      ] },
      { name: { ar: 'الرياضة', en: 'Sports' }, subs: [
        { ar: 'كرة قدم', en: 'Football' }, { ar: 'سلة', en: 'Basketball' },
        { ar: 'تنس', en: 'Tennis' }, { ar: 'ريشة', en: 'Badminton' },
      ] },
      { name: { ar: 'ألعاب الركوب', en: 'Ride-Ons' }, subs: [
        { ar: 'سيارات', en: 'Ride-on Cars' }, { ar: 'دفع', en: 'Push Cars' }, { ar: 'كهربائية', en: 'Electric Cars' },
      ] },
      { name: { ar: 'السكوترات', en: 'Scooters' }, subs: [
        { ar: 'أطفال', en: 'Kids Scooters' }, { ar: '3 عجلات', en: '3-Wheel Scooters' },
      ] },
      { name: { ar: 'الدراجات', en: 'Bikes' }, subs: [
        { ar: 'توازن', en: 'Balance Bikes' }, { ar: 'أطفال', en: 'Kids Bikes' },
      ] },
      { name: { ar: 'اللعب المائي', en: 'Water Play' }, subs: [
        { ar: 'مسدسات', en: 'Water Guns' }, { ar: 'ألعاب ماء', en: 'Water Toys' }, { ar: 'مسابح', en: 'Pools' },
      ] },
      { name: { ar: 'ألعاب الشاطئ', en: 'Beach Toys' }, subs: [
        { ar: 'رمل', en: 'Sand Sets' }, { ar: 'شاطئ', en: 'Beach Sets' }, { ar: 'دلاء', en: 'Buckets' },
      ] },
      { name: { ar: 'السباحة', en: 'Swimming' }, subs: [
        { ar: 'ألعاب', en: 'Swimming Toys' }, { ar: 'عوامات', en: 'Floats' }, { ar: 'إكسسوارات', en: 'Pool Accessories' },
      ] },
      { name: { ar: 'زحاليق وأراجيح', en: 'Slides & Swings' }, subs: [
        { ar: 'زحاليق', en: 'Slides' }, { ar: 'أراجيح', en: 'Swings' }, { ar: 'هياكل', en: 'Play Structures' },
      ] },
      { name: { ar: 'التسلق', en: 'Climbing' }, subs: [
        { ar: 'تسلق', en: 'Climbing Toys' }, { ar: 'داخلي', en: 'Indoor Climbers' },
      ] },
      { name: { ar: 'ألعاب الحركة', en: 'Active Games' }, subs: [
        { ar: 'حبل', en: 'Jump Ropes' }, { ar: 'هولا', en: 'Hula Hoops' }, { ar: 'حركة', en: 'Movement Games' },
      ] },
    ],
  },
  {
    id: 'collect', name: { ar: 'VELVET COLLECT', en: 'VELVET COLLECT' }, short: { ar: 'كولكت', en: 'Collect' },
    tagline: { ar: 'المقتنيات وهواة الألعاب', en: 'Collectibles & Kidults' }, color: '#d4a574',
    productBrands: ['Pokémon', 'Funko', 'Marvel', 'DC', 'Disney', 'Bandai', 'Other'],
    categories: [
      { name: { ar: 'مجسمات مقتناة', en: 'Collectible Figures' }, subs: [
        { ar: 'شخصيات', en: 'Character Figures' }, { ar: 'محدودة', en: 'Limited Figures' },
      ] },
      { name: { ar: 'شخصيات الحركة', en: 'Action Figures' }, subs: [
        { ar: 'Marvel', en: 'Marvel' }, { ar: 'DC', en: 'DC' }, { ar: 'Anime', en: 'Anime' }, { ar: 'أفلام', en: 'Movies' },
      ] },
      { name: { ar: 'صناديق عشوائية', en: 'Blind Boxes' }, subs: [
        { ar: 'مصغرة', en: 'Mini Figures' }, { ar: 'غموض', en: 'Mystery Boxes' },
      ] },
      { name: { ar: 'بطاقات التداول', en: 'Trading Cards' }, subs: [
        { ar: 'Pokémon', en: 'Pokémon' }, { ar: 'رياضة', en: 'Sports' }, { ar: 'مقتناة', en: 'Collectible Cards' },
      ] },
      { name: { ar: 'أنمي ومانجا', en: 'Anime & Manga' }, subs: [
        { ar: 'مجسمات', en: 'Anime Figures' }, { ar: 'مقتنيات', en: 'Anime Collectibles' },
      ] },
      { name: { ar: 'مقتنيات شخصيات', en: 'Character Collectibles' }, subs: [
        { ar: 'Disney', en: 'Disney' }, { ar: 'Marvel', en: 'Marvel' }, { ar: 'DC', en: 'DC' }, { ar: 'ألعاب', en: 'Gaming' },
      ] },
      { name: { ar: 'نماذج التركيب', en: 'Model Kits' }, subs: [
        { ar: 'سيارات', en: 'Cars' }, { ar: 'طائرات', en: 'Aircraft' },
        { ar: 'أنمي', en: 'Anime' }, { ar: 'عمارة', en: 'Architecture' },
      ] },
      { name: { ar: 'ليجو للبالغين', en: 'Adult LEGO' }, subs: [
        { ar: 'Architecture', en: 'Architecture' }, { ar: 'Technic', en: 'Technic' },
        { ar: 'Icons', en: 'Icons' }, { ar: 'Collectors', en: 'Collectors' },
      ] },
      { name: { ar: 'إصدارات محدودة', en: 'Limited Editions' }, subs: [
        { ar: 'حصري', en: 'Exclusive' }, { ar: 'محدود', en: 'Limited' }, { ar: 'نادر', en: 'Rare' },
      ] },
      { name: { ar: 'إكسسوارات مقتنيات', en: 'Collector Accessories' }, subs: [
        { ar: 'عرض', en: 'Display Cases' }, { ar: 'تخزين', en: 'Storage' }, { ar: 'حماية', en: 'Protection' },
      ] },
    ],
  },
  {
    id: 'plush', name: { ar: 'VELVET PLUSH', en: 'VELVET PLUSH' }, short: { ar: 'بلاش', en: 'Plush' },
    tagline: { ar: 'الألعاب الناعمة', en: 'Soft Toys' }, color: '#f5b5c8',
    productBrands: ['Disney', 'Steiff', 'GUND', 'Squishmallows', 'Other'],
    categories: [
      { name: { ar: 'دمى الدببة', en: 'Teddy Bears' }, subs: [
        { ar: 'كلاسيك', en: 'Classic Bears' }, { ar: 'كبيرة', en: 'Large Bears' }, { ar: 'مصغرة', en: 'Mini Bears' },
      ] },
      { name: { ar: 'حيوانات محشوة', en: 'Animal Plush' }, subs: [
        { ar: 'كلاب', en: 'Dogs' }, { ar: 'قطط', en: 'Cats' },
        { ar: 'برية', en: 'Wild Animals' }, { ar: 'مزرعة', en: 'Farm Animals' },
      ] },
      { name: { ar: 'شخصيات محشوة', en: 'Character Plush' }, subs: [
        { ar: 'Disney', en: 'Disney' }, { ar: 'Anime', en: 'Anime' }, { ar: 'كرتون', en: 'Cartoon Characters' },
      ] },
      { name: { ar: 'دمى تفاعلية', en: 'Interactive Plush' }, subs: [
        { ar: 'تتكلم', en: 'Talking' }, { ar: 'تتحرك', en: 'Moving' }, { ar: 'تغني', en: 'Singing' },
      ] },
      { name: { ar: 'دمى للرضع', en: 'Baby Plush' }, subs: [
        { ar: 'حيوانات بيبي', en: 'Baby Animals' }, { ar: 'راحة', en: 'Comfort Toys' },
      ] },
      { name: { ar: 'وسائد محشوة', en: 'Pillow Plush' }, subs: [
        { ar: 'شخصيات', en: 'Character Pillows' }, { ar: 'حيوانات', en: 'Animal Pillows' },
      ] },
      { name: { ar: 'دمى مقتناة', en: 'Collectible Plush' }, subs: [
        { ar: 'محدودة', en: 'Limited Plush' }, { ar: 'مصغرة', en: 'Mini Plush' },
      ] },
    ],
  },
  {
    id: 'books', name: { ar: 'VELVET BOOKS', en: 'VELVET BOOKS' }, short: { ar: 'بوكس', en: 'Books' },
    tagline: { ar: 'الكتب والقصص', en: 'Books & Stories' }, color: '#9bb8d4',
    productBrands: ['Usborne', 'Scholastic', 'Disney Books', 'Local Publishers', 'Other'],
    categories: [
      { name: { ar: 'كتب القصص', en: 'Story Books' }, subs: [
        { ar: 'خرافية', en: 'Fairy Tales' }, { ar: 'مغامرة', en: 'Adventure' },
        { ar: 'حيوانات', en: 'Animals' }, { ar: 'نوم', en: 'Bedtime' },
      ] },
      { name: { ar: 'كتب تعليمية', en: 'Educational Books' }, subs: [
        { ar: 'علوم', en: 'Science' }, { ar: 'رياضيات', en: 'Math' },
        { ar: 'لغة', en: 'Language' }, { ar: 'جغرافيا', en: 'Geography' },
      ] },
      { name: { ar: 'كتب مقواة', en: 'Board Books' }, subs: [
        { ar: 'بيبي', en: 'Baby Books' }, { ar: 'صغار', en: 'Toddler Books' },
      ] },
      { name: { ar: 'كتب أنشطة', en: 'Activity Books' }, subs: [
        { ar: 'متاهات', en: 'Mazes' }, { ar: 'مطابقة', en: 'Matching' },
        { ar: 'تلوين', en: 'Coloring' }, { ar: 'أنشطة', en: 'Activities' },
      ] },
      { name: { ar: 'كتب تلوين', en: 'Coloring Books' }, subs: [
        { ar: 'أطفال', en: 'Kids' }, { ar: 'ما قبل المدرسة', en: 'Preschool' }, { ar: 'متقدم', en: 'Advanced' },
      ] },
      { name: { ar: 'كتب تفاعلية', en: 'Interactive Books' }, subs: [
        { ar: 'صوت', en: 'Sound' }, { ar: 'لمس', en: 'Touch & Feel' }, { ar: 'قلّب', en: 'Lift-the-Flap' },
      ] },
      { name: { ar: 'كتب إسلامية', en: 'Islamic Books' }, subs: [
        { ar: 'قصص قرآن', en: 'Quran Stories' }, { ar: 'أنبياء', en: 'Prophets' }, { ar: 'قيم', en: 'Islamic Values' },
      ] },
      { name: { ar: 'كتب ألغاز', en: 'Puzzle Books' }, subs: [
        { ar: 'منطق', en: 'Logic' }, { ar: 'IQ', en: 'IQ' }, { ar: 'بازل', en: 'Puzzles' },
      ] },
      { name: { ar: 'قصص مصورة', en: 'Comics & Graphic Books' }, subs: [
        { ar: 'كوميكس', en: 'Comics' }, { ar: 'روايات مصورة', en: 'Graphic Novels' },
      ] },
    ],
  },
  {
    id: 'muslim', name: { ar: 'VELVET MUSLIM', en: 'VELVET MUSLIM' }, short: { ar: 'مسلم', en: 'Muslim' },
    tagline: { ar: 'الألعاب والتعليم الإسلامي', en: 'Islamic Toys & Learning' }, color: '#7dcea0',
    productBrands: ['Desi Dolls', 'Noor Kids', 'Islamic Toys Co', 'Local Islamic', 'Other'],
    categories: [
      { name: { ar: 'تعليم القرآن', en: 'Quran Learning' }, subs: [
        { ar: 'أجهزة', en: 'Quran Devices' }, { ar: 'كتب', en: 'Quran Books' }, { ar: 'حفظ', en: 'Memorization' },
      ] },
      { name: { ar: 'تعليم الصلاة', en: 'Salah Learning' }, subs: [
        { ar: 'ألعاب صلاة', en: 'Prayer Toys' }, { ar: 'سجاد', en: 'Prayer Mats' }, { ar: 'تعلم', en: 'Salah Learning' },
      ] },
      { name: { ar: 'تعليم الوضوء', en: 'Wudu Learning' }, subs: [
        { ar: 'مجموعات', en: 'Wudu Sets' }, { ar: 'أنشطة', en: 'Educational Activities' },
      ] },
      { name: { ar: 'رمضان', en: 'Ramadan' }, subs: [
        { ar: 'أنشطة', en: 'Ramadan Activities' }, { ar: 'تقويم', en: 'Calendars' },
        { ar: 'ديكور', en: 'Decorations' }, { ar: 'هدايا', en: 'Gifts' },
      ] },
      { name: { ar: 'الحج والعمرة', en: 'Hajj & Umrah' }, subs: [
        { ar: 'مجموعات', en: 'Hajj Sets' }, { ar: 'كعبة', en: 'Kaaba Models' }, { ar: 'ألعاب تعليمية', en: 'Educational Games' },
      ] },
      { name: { ar: 'قصص إسلامية', en: 'Islamic Stories' }, subs: [
        { ar: 'أنبياء', en: 'Prophets' }, { ar: 'صحابة', en: 'Sahaba' }, { ar: 'تاريخ', en: 'Islamic History' },
      ] },
      { name: { ar: 'بازل إسلامي', en: 'Islamic Puzzles' }, subs: [
        { ar: 'جيغسو', en: 'Islamic Jigsaw' }, { ar: 'ثلاثي', en: 'Islamic 3D' }, { ar: 'IQ', en: 'Islamic IQ' },
      ] },
      { name: { ar: 'ألعاب إسلامية', en: 'Islamic Board Games' }, subs: [
        { ar: 'عائلي', en: 'Family' }, { ar: 'تعليمي', en: 'Educational' }, { ar: 'كويز', en: 'Quiz' },
      ] },
      { name: { ar: 'بناء إسلامي', en: 'Islamic Building' }, subs: [
        { ar: 'كعبة', en: 'Kaaba' }, { ar: 'مساجد', en: 'Mosques' },
        { ar: 'أقصى', en: 'Al-Aqsa' }, { ar: 'عمارة', en: 'Architecture' },
      ] },
      { name: { ar: 'دمى إسلامية', en: 'Muslim Dolls' }, subs: [
        { ar: 'دمى', en: 'Muslim Dolls' }, { ar: 'محتشمة', en: 'Modest Fashion' }, { ar: 'إكسسوارات', en: 'Accessories' },
      ] },
      { name: { ar: 'أنشطة إسلامية', en: 'Islamic Activity' }, subs: [
        { ar: 'تلوين', en: 'Coloring' }, { ar: 'أشغال', en: 'Crafts' },
        { ar: 'أوراق', en: 'Worksheets' }, { ar: 'كيت', en: 'Activity Kits' },
      ] },
      { name: { ar: 'هدايا العيد', en: 'Eid Gifts' }, subs: [
        { ar: 'ألعاب عيد', en: 'Eid Toys' }, { ar: 'مجموعات', en: 'Gift Sets' }, { ar: 'هدايا أطفال', en: "Children's Gifts" },
      ] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Brand showcase metadata: homepage banner, logo slot and media per sub-brand.
// Each VELVET sub-brand owns a landing /{locale}/brands/{slug} page.
// ---------------------------------------------------------------------------
const BRAND_SHOWCASE = {
  baby: { order: 1, kickerEn: 'Soft beginnings', kickerAr: 'بدايات ناعمة', palette: ['#2f7d5e', '#7ec8a3', '#d9f1e3'], scene: 'nursery', logo: { en: 'BABY', ar: 'بيبي' } },
  kids: { order: 2, kickerEn: 'Everyday adventures', kickerAr: 'مغامرات يومية', palette: ['#a5601f', '#f0b27a', '#fdecd6'], scene: 'toybox', logo: { en: 'KIDS', ar: 'كيدز' } },
  play: { order: 3, kickerEn: 'Pretend & imagine', kickerAr: 'تخيّل والعب', palette: ['#9c3f68', '#e8a0bf', '#fce4ee'], scene: 'stage', logo: { en: 'PLAY', ar: 'بلاي' } },
  build: { order: 4, kickerEn: 'Construct & create', kickerAr: 'ابنِ واصنع', palette: ['#2f6ca0', '#7eb6d9', '#e3f0fa'], scene: 'blueprint', logo: { en: 'BUILD', ar: 'بيلد' } },
  learn: { order: 5, kickerEn: 'Discover & grow', kickerAr: 'اكتشف وتعلّم', palette: ['#4c7d34', '#a8d08d', '#e9f5df'], scene: 'classroom', logo: { en: 'LEARN', ar: 'ليرن' } },
  create: { order: 6, kickerEn: 'Make it yours', kickerAr: 'اصنعها بنفسك', palette: ['#b07f13', '#f2c14e', '#fdf2cf'], scene: 'studio', logo: { en: 'CREATE', ar: 'كريت' } },
  games: { order: 7, kickerEn: 'Play together', kickerAr: 'العب معاً', palette: ['#8a4fa8', '#c9a0dc', '#f0e2f8'], scene: 'gamenight', logo: { en: 'GAMES', ar: 'جيمز' } },
  move: { order: 8, kickerEn: 'Get moving', kickerAr: 'تحرّك والعب', palette: ['#2f8a84', '#6ec6c0', '#ddf4f1'], scene: 'sports', logo: { en: 'MOVE', ar: 'موف' } },
  collect: { order: 9, kickerEn: 'Find your favorites', kickerAr: 'اجمع ما تحب', palette: ['#9c5f2e', '#d4a574', '#f6ead8'], scene: 'collection', logo: { en: 'COLLECT', ar: 'كولكت' } },
  plush: { order: 10, kickerEn: 'Soft & cuddly', kickerAr: 'ناعم ورقيق', palette: ['#b34a6f', '#f5b5c8', '#fde3eb'], scene: 'cuddle', logo: { en: 'PLUSH', ar: 'بلاش' } },
  books: { order: 11, kickerEn: 'Stories to explore', kickerAr: 'قصص لاكتشاف', palette: ['#3f6f9b', '#9bb8d4', '#e4eff9'], scene: 'library', logo: { en: 'BOOKS', ar: 'بوكس' } },
  muslim: { order: 12, kickerEn: 'Faith & fun', kickerAr: 'إيمان ومرح', palette: ['#2f7d58', '#7dcea0', '#e2f4ea'], scene: 'muslim', logo: { en: 'MUSLIM', ar: 'مسلم' } },
};

// ---------------------------------------------------------------------------
// Normalize: derive stable language-independent slugs, unique per brand.
// ---------------------------------------------------------------------------
function normalizeBrands(raw) {
  return raw.map((brand, index) => {
    const showcase = BRAND_SHOWCASE[brand.id] || {};
    const palette = showcase.palette || [brand.color, brand.color, brand.color];
    const used = new Set();
    const categories = brand.categories.map((category) => {
      const categorySlug = uniqueSlug(slugify(category.name.en), used);
      const subs = category.subs.map((sub) => {
        const slug = uniqueSlug(slugify(sub.en), used);
        return { id: slug, slug, name: { en: sub.en, ar: sub.ar } };
      });
      return { id: categorySlug, slug: categorySlug, name: { en: category.name.en, ar: category.name.ar }, subs };
    });
    return {
      id: brand.id, slug: brand.id, name: brand.name, short: brand.short,
      tagline: brand.tagline, color: brand.color, productBrands: brand.productBrands, categories,
      accent: palette[0],
      heroVideo: '',
      heroPoster: '',
      logoUrl: '',
      home: {
        order: showcase.order || index + 1,
        kickerEn: showcase.kickerEn || brand.short.en,
        kickerAr: showcase.kickerAr || brand.short.ar,
        palette,
        scene: showcase.scene || 'play',
        logo: showcase.logo || brand.short,
        accent: palette[0],
        heroVideo: '',
        heroPoster: '',
      },
      image: artwork(`${brand.name.en} world`, palette, (index % 6) + 1),
      palette,
      scene: showcase.scene || 'play',
      logo: showcase.logo || brand.short,
    };
  });
}

function uniqueSlug(base, used) {
  let candidate = base || 'item';
  let index = 2;
  while (used.has(candidate)) candidate = `${base}-${index++}`;
  used.add(candidate);
  return candidate;
}

const STATIC_BRANDS = normalizeBrands(RAW_BRANDS);
export let velvetBrands = STATIC_BRANDS;
let dynamicCatalogMode = false;

// Swap the runtime catalog to the platform-driven tree (or back to the static
// fallback when `brands`/`products` are null or empty).
export function applyDynamicCatalog(brands = null, products = null) {
  if (!Array.isArray(brands) || brands.length === 0) {
    dynamicCatalogMode = false;
    velvetBrands = STATIC_BRANDS;
    velvetProducts = STATIC_PRODUCTS;
    return;
  }
  dynamicCatalogMode = true;
  velvetBrands = brands;
  velvetProducts = Array.isArray(products) ? products : [];
}

// ---------------------------------------------------------------------------
// Filter dictionary (independent of the category tree).
// ---------------------------------------------------------------------------
const filterItem = (id, en, ar) => ({ id, name: { en, ar } });

export const filterGroups = {
  age: [
    filterItem('0-12m', '0–12 Months', '0–12 شهر'),
    filterItem('1-2y', '1–2 Years', '1–2 سنة'),
    filterItem('3-4y', '3–4 Years', '3–4 سنوات'),
    filterItem('5-6y', '5–6 Years', '5–6 سنوات'),
    filterItem('7-9y', '7–9 Years', '7–9 سنوات'),
    filterItem('10-12y', '10–12 Years', '10–12 سنة'),
    filterItem('13+', '13+', '13+'),
    filterItem('adults', 'Adults', 'البالغون'),
  ],
  gender: [
    filterItem('boys', 'Boys', 'أولاد'),
    filterItem('girls', 'Girls', 'بنات'),
    filterItem('unisex', 'Unisex', 'للجميع'),
  ],
  skill: [
    filterItem('creativity', 'Creativity', 'الإبداع'),
    filterItem('imagination', 'Imagination', 'الخيال'),
    filterItem('fine-motor', 'Fine Motor', 'مهارات دقيقة'),
    filterItem('gross-motor', 'Gross Motor', 'مهارات كبرى'),
    filterItem('problem', 'Problem Solving', 'حل المشكلات'),
    filterItem('logic', 'Logic', 'المنطق'),
    filterItem('memory', 'Memory', 'الذاكرة'),
    filterItem('stem', 'STEM', 'STEM'),
    filterItem('social', 'Social Skills', 'اجتماعية'),
    filterItem('language', 'Language', 'اللغة'),
    filterItem('emotional', 'Emotional', 'عاطفي'),
  ],
  occasion: [
    filterItem('birthday', 'Birthday', 'عيد ميلاد'),
    filterItem('eid', 'Eid', 'عيد'),
    filterItem('ramadan', 'Ramadan', 'رمضان'),
    filterItem('christmas', 'Christmas', 'كريسماس'),
    filterItem('school', 'Back to School', 'عودة للمدرسة'),
    filterItem('newbaby', 'New Baby', 'مولود جديد'),
    filterItem('gift', 'Gift', 'هدية'),
  ],
  shopping: [
    filterItem('new', 'New Arrivals', 'وصل حديثًا'),
    filterItem('bestsellers', 'Best Sellers', 'الأكثر مبيعًا'),
    filterItem('offers', 'Offers', 'العروض'),
    filterItem('exclusive', 'Exclusive', 'حصري'),
    filterItem('limited', 'Limited Edition', 'إصدار محدود'),
    filterItem('gifts', 'Gift Ideas', 'أفكار هدايا'),
    filterItem('u50', 'Under 50', 'أقل من 50'),
    filterItem('u100', 'Under 100', 'أقل من 100'),
  ],
};

export const quickShopGroups = ['age', 'gender', 'skill', 'occasion', 'shopping'];

// ---------------------------------------------------------------------------
// Deterministic product catalog.
// ---------------------------------------------------------------------------
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PALETTES = [
  ['#ffad32', '#ff5f45', '#79233b'], ['#d95ad1', '#8af06d', '#4d1760'], ['#ffd0dc', '#fff0c5', '#a63b68'],
  ['#182045', '#1fd8f2', '#ff275f'], ['#f1a1e5', '#9ce6dd', '#ffd056'], ['#25c8e8', '#ffea4a', '#1460aa'],
  ['#ff8349', '#ffd242', '#824229'], ['#819dff', '#ef9fe3', '#473d92'], ['#ffb6c8', '#f6e6ce', '#a73b68'],
  ['#7be6db', '#5986f2', '#13324f'],
];

const SUFFIXES = ['Set', 'Pack', 'Studio', 'Kit', 'Deluxe', 'Combo'];
const SUFFIXES_AR = ['مجموعة', 'حقيبة', 'استوديو', 'طقم', 'فاخر', 'كومبو'];
const BADGE_AR = { Offer: 'عرض', Exclusive: 'حصري', Limited: 'إصدار محدود', New: 'جديد', 'Best Seller': 'الأكثر مبيعًا' };

// Existing real products → VELVET placement. Every slug below exists in ./products.js.
const REAL_PRODUCT_ATTRIBUTES = {
  'pocket-worlds-starter-set': { brandId: 'collect', categoryId: 'blind-boxes', subId: 'mini-figures', manufacturer: 'Other', age: '5-6y', gender: 'unisex', skill: 'creativity', occasion: 'gift', shopping: ['new', 'gifts', 'u50'] },
  'odd-pals-plush': { brandId: 'plush', categoryId: 'collectible-plush', subId: 'mini-plush', manufacturer: 'Other', age: '3-4y', gender: 'unisex', skill: 'emotional', occasion: 'birthday', shopping: ['new', 'gifts', 'bestsellers'] },
  'tiny-table-bake-studio': { brandId: 'create', categoryId: 'kids-cooking', subId: 'baking-kits', manufacturer: 'Other', age: '7-9y', gender: 'girls', skill: 'creativity', occasion: 'birthday', shopping: ['new', 'gifts'] },
  'neon-racers-twin-pack': { brandId: 'move', categoryId: 'ride-ons', subId: 'push-cars', manufacturer: 'Other', age: '5-6y', gender: 'boys', skill: 'gross-motor', occasion: 'birthday', shopping: ['new', 'gifts', 'u50'] },
  'bloom-pets-surprise-pod': { brandId: 'collect', categoryId: 'blind-boxes', subId: 'mystery-boxes', manufacturer: 'Other', age: '3-4y', gender: 'unisex', skill: 'creativity', occasion: 'birthday', shopping: ['new', 'u50'] },
  'splash-lab-water-blaster': { brandId: 'move', categoryId: 'water-play', subId: 'water-guns', manufacturer: 'Other', age: '7-9y', gender: 'unisex', skill: 'gross-motor', occasion: 'gift', shopping: ['new', 'u50'] },
  'build-club-maker-kit': { brandId: 'build', categoryId: 'building-blocks', subId: 'classic-blocks', manufacturer: 'Other', age: '7-9y', gender: 'unisex', skill: 'stem', occasion: 'gift', shopping: ['new', 'bestsellers', 'u50'] },
  'cloud-dough-color-pack': { brandId: 'create', categoryId: 'clay-and-modeling', subId: 'play-dough', manufacturer: 'Other', age: '3-4y', gender: 'unisex', skill: 'fine-motor', occasion: 'school', shopping: ['new', 'u50'] },
};

function buildShopping(base, price, hasOffer) {
  const tags = [...(base || [])];
  if (price < 50) tags.push('u50');
  if (price < 100) tags.push('u100');
  if (hasOffer && !tags.includes('offers')) tags.push('offers');
  return [...new Set(tags)];
}

function makeSyntheticProduct(brand, category, sub, manufacturer, k) {
  const seed = `${brand.slug}:${category.slug}:${sub.slug}:${manufacturer}:${k}`;
  const h = hash(seed);
  const age = filterGroups.age[h % filterGroups.age.length];
  const gender = filterGroups.gender[(h >> 3) % filterGroups.gender.length];
  const skill = filterGroups.skill[(h >> 5) % filterGroups.skill.length];
  const occasion = filterGroups.occasion[(h >> 7) % filterGroups.occasion.length];
  const price = 25 + (h % 35) * 5;

  const shopping = [];
  if (h % 5 === 0) shopping.push('new');
  if (h % 7 === 0) shopping.push('bestsellers');
  if (h % 6 === 0) shopping.push('offers');
  if (h % 11 === 0) shopping.push('exclusive');
  if (h % 13 === 0) shopping.push('limited');
  if (h % 4 === 0) shopping.push('gifts');

  const suffixIndex = (h >> 9) % SUFFIXES.length;
  const slug = `${sub.slug}-${slugify(manufacturer)}-${k + 1}`;
  const nameEn = `${sub.name.en} ${SUFFIXES[suffixIndex]}`;
  const nameAr = `${sub.name.ar} ${SUFFIXES_AR[suffixIndex]}`;
  const hasOffer = shopping.includes('offers');
  const badge = hasOffer ? 'Offer' : shopping.includes('exclusive') ? 'Exclusive' : shopping.includes('limited') ? 'Limited' : shopping.includes('new') ? 'New' : shopping.includes('bestsellers') ? 'Best Seller' : '';
  const colors = PALETTES[h % PALETTES.length];
  const image = artwork(nameEn, colors, h % 6);
  const hoverImage = artwork(nameEn, [colors[1], colors[2], colors[0]], (h >> 4) % 6);
  const detailImage = artwork(nameEn, [colors[2], colors[0], colors[1]], (h >> 8) % 6);
  const descriptionEn = `A ${category.name.en.toLowerCase()} pick from ${manufacturer}, made for ${age.name.en.toLowerCase()} play.`;
  const descriptionAr = `خيار من ${category.name.ar} من ${manufacturer}، مصمم للعب في عمر ${age.name.ar}.`;

  return {
    id: `v-${slug}`,
    slug,
    name: nameEn,
    nameAr,
    category: category.name.en,
    categoryId: category.slug,
    categorySlug: category.slug,
    brandId: brand.slug,
    subcategoryId: sub.slug,
    manufacturer,
    manufacturerId: slugify(manufacturer),
    price,
    originalPrice: hasOffer ? Math.round(price * 1.2) : null,
    badge,
    badgeAr: BADGE_AR[badge] || badge,
    shortDescription: descriptionEn.split('.')[0] + '.',
    shortDescriptionAr: descriptionAr.split('.')[0] + '.',
    description: descriptionEn,
    descriptionAr,
    image,
    hoverImage,
    gallery: [image, hoverImage, detailImage],
    colors,
    options: [],
    availability: 'In stock',
    availabilityAr: 'متوفر',
    age: age.id,
    gender: gender.id,
    skill: skill.id,
    occasion: occasion.id,
    shopping: buildShopping(shopping, price, hasOffer),
    usageVideo: '',
    usageVideoPoster: '',
    velvetPath: { brandId: brand.slug, categoryId: category.slug, subcategoryId: sub.slug },
  };
}

function buildCatalog() {
  const list = [];
  const PER_SUBCATEGORY = 2;
  velvetBrands.forEach((brand) => {
    brand.categories.forEach((category) => {
      category.subs.forEach((sub) => {
        const base = hash(`${brand.slug}:${category.slug}:${sub.slug}`);
        for (let k = 0; k < PER_SUBCATEGORY; k++) {
          const manufacturer = brand.productBrands[(base + k) % brand.productBrands.length];
          list.push(makeSyntheticProduct(brand, category, sub, manufacturer, k));
        }
      });
    });
  });

  // Merge real products (keeps images, options, prices, descriptions, cart keys).
  products.forEach((product) => {
    const attrs = REAL_PRODUCT_ATTRIBUTES[product.slug];
    if (!attrs) return;
    const brand = getBrand(attrs.brandId);
    const category = getCategory(brand?.slug, attrs.categoryId);
    const sub = category?.subs.find((item) => item.slug === attrs.subId);
    if (!brand || !category || !sub) return;
    const shopping = buildShopping(attrs.shopping, product.price, Boolean(product.originalPrice));
    list.push({
      ...product,
      brandId: brand.slug,
      categoryId: category.slug,
      categorySlug: category.slug,
      subcategoryId: sub.slug,
      manufacturer: attrs.manufacturer,
      manufacturerId: slugify(attrs.manufacturer),
      age: attrs.age,
      gender: attrs.gender,
      skill: attrs.skill,
      occasion: attrs.occasion,
      shopping,
      velvetPath: { brandId: brand.slug, categoryId: category.slug, subcategoryId: sub.slug },
    });
  });

  return list;
}

export let velvetProducts = buildCatalog();
const STATIC_PRODUCTS = velvetProducts;

// ---------------------------------------------------------------------------
// Lookup helpers.
// ---------------------------------------------------------------------------
export function getBrand(brandSlug) {
  return velvetBrands.find((brand) => brand.slug === brandSlug) || null;
}

// Resolve a brand's hero media. Entity-owned fields (brand.heroVideo /
// brand.heroPoster) are canonical; the legacy `brand.{slug}.video` /
// `brand.{slug}.poster` platform slots and the static config are fallbacks
// only, so the storefront consumes the brand's own media directly.
export function getBrandMedia(brandSlug) {
  const brand = getBrand(brandSlug);
  if (!brand) return { video: '', poster: '' };
  const video = brand.heroVideo || getPlatformMedia(`brand.${brandSlug}.video`, brand.home.heroVideo || '');
  const poster = brand.heroPoster || getPlatformMedia(`brand.${brandSlug}.poster`, brand.home.heroPoster || brand.image || '');
  return { video, poster };
}

// Resolve a brand's managed logo image. Entity-owned brand.logoUrl is
// canonical; the legacy `brand.{slug}.logo` platform slot is the fallback.
// When absent the storefront keeps its local/static branch logo (the brand
// wordmark), so this returns '' to signal the caller to fall back.
export function getBrandLogo(brandSlug) {
  if (!brandSlug) return '';
  const brand = getBrand(brandSlug);
  return brand?.logoUrl || getPlatformMedia(`brand.${brandSlug}.logo`, '');
}

export function getCategory(brandSlug, categorySlug) {
  return getBrand(brandSlug)?.categories.find((category) => category.slug === categorySlug) || null;
}

export function getSubcategory(brandSlug, categorySlug, subSlug) {
  return getCategory(brandSlug, categorySlug)?.subs.find((sub) => sub.slug === subSlug) || null;
}

export function resolvePath(state) {
  const brand = state.brand ? getBrand(state.brand) : null;
  const category = brand && state.category ? getCategory(brand.slug, state.category) : null;
  const sub = category && state.subcategory ? getSubcategory(brand.slug, category.slug, state.subcategory) : null;
  return { brand, category, sub };
}

export function getManufacturerName(manufacturerId) {
  return velvetProducts.find((product) => product.manufacturerId === manufacturerId)?.manufacturer || '';
}

export function getVelvetPathLabel(product, locale = 'en') {
  const path = product?.velvetPath;
  if (!path) return '';
  const sub = getSubcategory(path.brandId, path.categoryId, path.subcategoryId);
  if (sub) return sub.name[locale];
  const category = getCategory(path.brandId, path.categoryId);
  if (category) return category.name[locale];
  return getBrand(path.brandId)?.name[locale] || '';
}

export function getProductBySlug(slug) {
  const catalogProduct = velvetProducts.find((product) => product.slug === slug) || null;
  if (dynamicCatalogMode) return catalogProduct;
  return catalogProduct || products.find((product) => product.slug === slug) || null;
}

// Resolve a product's "how to use" media. The product's entity-owned
// usageVideo / usageVideoPoster fields are canonical; the legacy
// `product.{slug}.usageVideo(/Poster)` platform slots are a fallback only
// (empty → section hidden).
export function getProductMedia(product) {
  const slug = product?.slug || '';
  const usageVideo = product?.usageVideo || getPlatformMedia(`product.${slug}.usageVideo`, '');
  const usageVideoPoster = product?.usageVideoPoster || getPlatformMedia(`product.${slug}.usageVideoPoster`, product?.gallery?.[0] || product?.image || '');
  return { usageVideo, usageVideoPoster };
}

// ---------------------------------------------------------------------------
// Filtering (deterministic).
// Path (brand + category + subcategory) is ANDed with every filter group.
// Within a group selections behave as OR.
// ---------------------------------------------------------------------------
export function getPathProducts(state) {
  return velvetProducts.filter((product) => {
    if (state.brand && product.velvetPath?.brandId !== state.brand) return false;
    if (state.category && product.velvetPath?.categoryId !== state.category) return false;
    if (state.subcategory && product.velvetPath?.subcategoryId !== state.subcategory) return false;
    return true;
  });
}

export function filterProducts(state) {
  const normalized = String(state.search || '').trim().toLowerCase();
  return velvetProducts.filter((product) => {
    if (state.brand && product.velvetPath?.brandId !== state.brand) return false;
    if (state.category && product.velvetPath?.categoryId !== state.category) return false;
    if (state.subcategory && product.velvetPath?.subcategoryId !== state.subcategory) return false;
    if (state.manufacturer && product.manufacturerId !== state.manufacturer) return false;
    if (state.age.length && !state.age.includes(product.age)) return false;
    if (state.gender.length && !state.gender.includes(product.gender)) return false;
    if (state.skill.length && !state.skill.includes(product.skill)) return false;
    if (state.occasion.length && !state.occasion.includes(product.occasion)) return false;
    if (state.shopping.length && !state.shopping.some((tag) => product.shopping.includes(tag))) return false;
    if (normalized) {
      const haystack = `${product.name} ${product.nameAr || ''} ${product.description} ${product.descriptionAr || ''} ${product.category || ''}`.toLowerCase();
      if (!haystack.includes(normalized)) return false;
    }
    return true;
  });
}

export function getManufacturersForPath(state) {
  const pathProducts = getPathProducts(state);
  const counts = new Map();
  pathProducts.forEach((product) => {
    if (!product.manufacturer) return;
    counts.set(product.manufacturerId, (counts.get(product.manufacturerId) || 0) + 1);
  });
  return [...counts.entries()].map(([id, count]) => ({
    id,
    name: pathProducts.find((product) => product.manufacturerId === id)?.manufacturer || id,
    count,
  }));
}

export function getFilterCounts(state) {
  const pathProducts = getPathProducts(state);
  const counts = { age: {}, gender: {}, skill: {}, occasion: {}, shopping: {} };
  pathProducts.forEach((product) => {
    if (product.age) counts.age[product.age] = (counts.age[product.age] || 0) + 1;
    if (product.gender) counts.gender[product.gender] = (counts.gender[product.gender] || 0) + 1;
    if (product.skill) counts.skill[product.skill] = (counts.skill[product.skill] || 0) + 1;
    if (product.occasion) counts.occasion[product.occasion] = (counts.occasion[product.occasion] || 0) + 1;
    (product.shopping || []).forEach((tag) => {
      counts.shopping[tag] = (counts.shopping[tag] || 0) + 1;
    });
  });
  return counts;
}
