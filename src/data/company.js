export const aboutSections = [
  {
    title: "Let's Reimagine", titleAr: 'لنتخيّل من جديد', eyebrow: 'Why we play', eyebrowAr: 'لماذا نلعب', image: '/media/poster-about.jpg', height: 982,
    paragraphs: ['PLAY begins with a simple belief: imagination deserves room to run. We make bright, tactile worlds that invite children to invent the rules, change the story, and start again.', 'Our teams pair curious thinking with careful craft. Every color, character, and click is shaped to feel joyful on day one and still surprising on day one hundred.'],
    paragraphsAr: ['تبدأ PLAY من إيمان بسيط: الخيال يستحق مساحة ينطلق فيها. نصنع عوالم مبهجة وملموسة تدعو الأطفال إلى ابتكار القواعد وتغيير القصة والبدء من جديد.', 'تجمع فرقنا بين الفضول والحرفة الدقيقة. نصمم كل لون وشخصية وتفصيل ليبقى ممتعاً ومفاجئاً مع مرور الوقت.'],
  },
  {
    title: 'Our Team and Culture', titleAr: 'فريقنا وثقافتنا', eyebrow: 'Built together', eyebrowAr: 'نبنيها معاً', image: '/media/poster-news.jpg', height: 853, reverse: true,
    paragraphs: ['Designers, storytellers, engineers, and play-testers share one table at PLAY. We work in small, open teams where an unfinished thought can become the beginning of an entirely new world.', 'We value generous feedback, bold experiments, and people who stay curious. The result is a culture with high standards, plenty of laughter, and real ownership from sketch to shelf.'],
    paragraphsAr: ['يجتمع المصممون ورواة القصص والمهندسون ومختبرو الألعاب حول طاولة واحدة في PLAY. نعمل ضمن فرق صغيرة ومنفتحة، حيث يمكن لفكرة غير مكتملة أن تصبح بداية عالم جديد.', 'نقدّر الملاحظات الصادقة والتجارب الجريئة والفضول المستمر. والنتيجة ثقافة ذات معايير عالية وروح مرحة ومسؤولية حقيقية من الفكرة إلى المنتج.'],
  },
  {
    title: 'Sustainability', titleAr: 'الاستدامة', eyebrow: 'Play it forward', eyebrowAr: 'لعب أفضل للمستقبل', image: '/media/poster-contact.jpg', height: 747,
    paragraphs: ['Tomorrow belongs to the children playing today. We are reducing unnecessary packaging, exploring recycled materials, and designing sturdy toys that stay in rotation longer.', 'Progress comes from thousands of practical choices. We measure, learn, and improve each collection so more wonder can arrive with less waste.'],
    paragraphsAr: ['المستقبل لأطفال اليوم. نعمل على تقليل التغليف غير الضروري واستكشاف المواد المعاد تدويرها وتصميم ألعاب متينة تدوم لفترة أطول.', 'يأتي التقدم من آلاف الخيارات العملية. نقيس ونتعلم ونطوّر كل مجموعة لتصل دهشة أكبر بنفايات أقل.'],
  },
  {
    title: 'Taking a Stand', titleAr: 'موقفنا', eyebrow: 'Room for everyone', eyebrowAr: 'مساحة للجميع', image: '/media/poster-about.jpg', height: 511, reverse: true,
    paragraphs: ['Play is a universal language. We support community partners who create safe, welcoming places for children to learn, make friends, and express themselves.', 'Inside PLAY, we keep widening the circle too. Different backgrounds and perspectives help us build richer worlds—and a company where more people can do their best work.'],
    paragraphsAr: ['اللعب لغة عالمية. ندعم شركاء المجتمع الذين يصنعون أماكن آمنة ومرحبة يتعلم فيها الأطفال ويكوّنون الصداقات ويعبّرون عن أنفسهم.', 'وفي PLAY نوسّع الدائرة باستمرار. تساعدنا الخلفيات ووجهات النظر المختلفة على بناء عوالم أغنى وشركة يستطيع فيها مزيد من الأشخاص تقديم أفضل ما لديهم.'],
  },
];

const newsSeeds = [
  { title: 'A first look inside our new Pocket Worlds studio', titleAr: 'نظرة أولى داخل استوديو Pocket Worlds الجديد', category: 'Studio Notes', categoryAr: 'أخبار الاستوديو', date: '2026-07-24', image: '/media/poster-news.jpg' },
  { title: 'Odd Pals wins a place in the summer play edit', titleAr: 'Odd Pals ضمن اختيارات ألعاب الصيف', category: 'Awards', categoryAr: 'جوائز', date: '2026-07-08', image: '/media/poster-about.jpg' },
  { title: 'How our designers turn tiny ideas into big stories', titleAr: 'كيف يحوّل مصممونا الأفكار الصغيرة إلى قصص كبيرة', category: 'Behind the Play', categoryAr: 'خلف الكواليس', date: '2026-06-19', image: '/media/poster-contact.jpg' },
  { title: 'PLAY opens a new community maker space', titleAr: 'PLAY تفتتح مساحة مجتمعية جديدة للصنّاع', category: 'Community', categoryAr: 'المجتمع', date: '2026-05-30', image: '/media/poster-news.jpg' },
  { title: 'Meet the color team behind Cloud Dough', titleAr: 'تعرّف إلى فريق الألوان وراء Cloud Dough', category: 'Behind the Play', categoryAr: 'خلف الكواليس', date: '2026-05-12', image: '/media/poster-about.jpg' },
];

export const newsItems = newsSeeds.map((item, index) => ({ id: `news-${index + 1}`, ...item }));
export const newsCategories = [
  { id: 'all', en: 'All', ar: 'الكل' },
  ...[...new Set(newsItems.map((item) => item.category))].map((category) => {
    const item = newsItems.find((entry) => entry.category === category);
    return { id: category.toLowerCase().replace(/\s+/g, '-'), en: category, ar: item.categoryAr };
  }),
];
