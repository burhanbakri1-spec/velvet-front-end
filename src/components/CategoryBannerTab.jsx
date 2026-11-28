// Home slugs are independent of category slugs. Keep the identity lookup
// separate so a category can never pick up a Home brand's icon by accident.
const brandIcons = {
  baby: 'M10 5V4a2 2 0 0 1 4 0v1l2 2v3H8V7l2-2Zm-1 5h6l2 3v7a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-7l2-3Zm3 4h5m-5 3h5',
  kids: 'M8 9V7a4 4 0 0 1 8 0v2m-8 0a4 4 0 0 0-4 4v2m12-6a4 4 0 0 1 4 4v2m-12-4v9m8-9v9m-4-6v6M10 6h.01m4 0h.01',
  play: 'm12 3 9 5v8l-9 5-9-5V8l9-5Zm0 9 9-4m-9 4L3 8m9 4v9M8 6l9 4',
  build: 'M3 12h18v8H3zM5 8h4v4H5zM15 8h4v4h-4zM9 16h6',
  learn: 'm2 9 10-5 10 5-10 5L2 9Zm5 3v5c3 3 7 3 10 0v-5m4-2v6',
  create: 'M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 1-4 2 2 0 0 1 1-4h3a2 2 0 0 0 2-2 9 9 0 0 0-9-8ZM7 10h.01M10 7h.01M15 7h.01',
  games: 'M8 7h8a4 4 0 0 1 4 3l2 7a2 2 0 0 1-3 2l-4-3H9l-4 3a2 2 0 0 1-3-2l2-7a4 4 0 0 1 4-3Zm0 3v4m-2-2h4m6-1h.01m2 2h.01',
  move: 'M16 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-6 18 3-5-3-3 3-5 3 4h4M4 17h4l2-4m-4-2 3-3h4',
  collect: 'M4 3h12v16H4zM8 22h12V6m-10 1 .8 2.1L13 10l-2.2.9L10 13l-.8-2.1L7 10l2.2-.9L10 7Z',
  plush: 'M6 8a3 3 0 1 1 4-4 10 10 0 0 1 4 0 3 3 0 1 1 4 4c2 2 3 4 3 6 0 4-4 7-9 7s-9-3-9-7c0-2 1-4 3-6Zm2 4h.01m8 0h.01m-6 4h4l-2 2-2-2Z',
  books: 'M12 5v15M12 5C9 2 5 3 2 4v15c4-2 7-2 10 1 3-3 6-3 10-1V4c-3-1-7-2-10 1Z',
  muslim: 'M16 3a9 9 0 1 0 5 14A8 8 0 0 1 16 3Zm3 1v5m-2.5-2.5h5',
};

const categoryTabs = {
  drawing: ['#ffe0ed', 'M4 16 15 5l4 4L8 20l-5 1 1-5Zm9-9 4 4'],
  coloring: ['#ffe6c6', 'M4 18 14 8l4 4L8 22H4v-4Zm10-10 2-4 4 4-2 4M4 22h16'],
  painting: ['#c7f3ed', 'M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 1-4 2 2 0 0 1 1-4h3a2 2 0 0 0 2-2 9 9 0 0 0-9-8ZM7 10h.01M10 7h.01M15 7h.01'],
  'clay-and-modeling': ['#e9dcff', 'M5 6h14M6 6l1 14h10l1-14M4 3h16v3H4zM10 11h4'],
  crafts: ['#ffe6f1', 'M8 8 20 20M8 16 20 4M12 12h.01M8 8a3 3 0 1 0-4 0 3 3 0 0 0 4 0Zm0 8a3 3 0 1 0-4 4 3 3 0 0 0 4-4Z'],
  'jewelry-making': ['#fff0ba', 'M3 9l4-5h10l4 5-9 11-9-11Zm0 0h18M10 4 8 9l4 11 4-11-2-5'],
  diy: ['#eddefb', 'M13 6 17 2l1 4 4 1-4 4-4-1-8 10a2 2 0 0 1-3-3l10-8V6Z'],
  'science-crafts': ['#cceffa', 'M9 3h6m-5 0v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10'],
  'sewing-and-textile': ['#ffdae8', 'M7 4h10l-2 3v10l2 3H7l2-3V7L7 4Zm2 5h6m-6 3h6m-6 3h6m0 2c3 0 4 3 6 3'],
  'kids-cooking': ['#e5f7c1', 'M7 15a4 4 0 1 1 0-8 5 5 0 0 1 10 0 4 4 0 1 1 0 8v5H7v-5Zm0 2h10'],
  'sand-art': ['#fff0c9', 'M7 3h10M7 21h10M8 3v3l4 6 4-6V3m-8 18v-3l4-6 4 6v3'],
  'activity-kits': ['#e1ecff', 'M4 7h16v13H4zM8 7V4h8v3M4 12h16m-10 0v2h4v-2'],
};

const folderIcon = 'M3 20V5h6l2 3h10v12H3Z';

export default function CategoryBannerTab({ slug, name, isBrand = false, logoSrc }) {
  const [background, icon] = isBrand
    ? [undefined, brandIcons[slug] || folderIcon]
    : categoryTabs[slug.replace(/^create-/, '')] || [undefined, folderIcon];

  return (
    <span
      className="brand-showcase__notebook-edge"
      aria-hidden="true"
      style={background ? { '--notebook-tab-bg': background } : undefined}
    >
      <span className="brand-showcase__notebook-tab">
        <svg className="brand-showcase__notebook-shape" viewBox="0 0 300 60" preserveAspectRatio="none" focusable="false">
          <path d="M0 60C20 58 27 47 35 30C43 12 53 2 73 2H227C247 2 257 12 265 30C273 47 280 58 300 60Z" />
        </svg>
        {!logoSrc && (
          <svg className="brand-showcase__notebook-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" focusable="false">
            <path d={icon} />
          </svg>
        )}
        {logoSrc ? (
          <span className="brand-showcase__notebook-logo-frame">
            <img className="brand-showcase__notebook-logo" src={logoSrc} alt="" />
          </span>
        ) : (
          <span>{name}</span>
        )}
      </span>
    </span>
  );
}
