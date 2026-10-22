# Product badge presentation

Storage is additive: `badgeMode` (`auto`, `custom`, `none`) and
`customBadge: { en, ar }` live in the existing `products.data` JSON. No database
migration, backfill, bulk product edit, or deletion is required. Product writes
preserve omitted data via the existing merge path. The public API retains the
legacy `badge` field and adds the new fields alongside `featured`, `newArrival`,
`bestseller`, and `quickShop`. Missing legacy mode stays absent in public JSON.

## Compatibility

Without an explicit mode, existing nonempty custom/label/badge text means Custom;
without text it means Auto. An old `Featured` string cannot safely be distinguished
from an intentional merchant label, so it is preserved. Opening a legacy product
in CPanel selects this effective mode; saving stores it explicitly. New products
start in Auto. Auto/None retain the custom text so switching back to Custom does
not erase it. Legacy aliases remain readable. A missing locale may fall back to
the other locale of the same product; text is never borrowed from another item.

## Rules and consumers

Auto priority: New Arrival (`New` / `وصل حديثًا`), Best Seller (`Best Seller` /
`الأكثر مبيعًا`), Featured (`Featured` / `مميز`), otherwise empty. Quick Buy only
controls behavior. Custom uses its stored localized values. None returns empty.

The storefront has one resolver, `getCustomerFacingProductBadge`; the historical
`getProductBadge` export is an alias, not a second implementation. Home strips,
ProductCard (shop/search/related/checkout), and PDP use it. PDP visibility depends
on the resolved text, including Arabic-only custom badges. Search suggestions,
category showcases and brand banners remain badge-free.

API/CPanel share `api/src/products/badgePresentation.js`. The independently built
Velvet repository distributes the same pure contract as `src/data/productBadge.js`.
Keep these copies identical when changing the contract; both have bilingual
contract tests. CPanel preview uses the shared resolver, not separate form logic.

New/Best Seller filter tags and Home bestseller sorting use official flags,
independent of custom label text and badge mode. Featured ordering stays official.

## Balloon-Powered Cars

A read-only public API GET on 2026-10-22 confirmed `velvet-src-284`, slug
`velvet-284`, with `newArrival: true`, `featured: false`, `bestseller: false`,
legacy badge EN `Featured`, AR `وصل حديثا `, and no badgeMode. Tests use this
public field subset. With explicit Auto, actual rendered Home, ProductCard and
PDP output `New` / `وصل حديثًا`. The same ProductCard is reused for related/search/
checkout recommendations. This is local rendered verification, not a deployment
or a change to the live product. Its legacy manual text remains until Auto is
explicitly saved by the merchant.

## Exact files changed in this repository

- `src/data/productBadge.js`
- `src/data/products.js`
- `src/data/platformContent.js`
- `src/data/dynamicCatalog.js`
- `src/data/brandProductStrip.js`
- `src/components/ProductDetailSlide.jsx`
- `test/product-badge.test.js`
- `test/product-badge-surfaces.test.js`
- `test/dynamic-catalog.test.js`
- `test/home-brand-product-strip.test.js`
- `docs/product-badges.md`

## Verification (2026-10-22)

- Velvet `npm test`: 505 passed, 0 failed. `npm run build`: passed.
- API: 33 passed, 0 failed across `product-badge`,
  `product-merchandising-phase-j`, `storefront-content`, `product-phase-b-api`.
  HTTP integration tests run against temporary stores with database URLs cleared.
- CPanel `node --test test/*.test.js`: 1191 passed, 10 failed (1201 total).
  All 6 new badge/form/render tests pass. An isolated `git archive HEAD`
  baseline produced the exact same 10 failing test names (1185 pass / 10 fail).
  Existing failures concern shell, bootstrap, hierarchy source assertions,
  storageKeys, email workspace, order delivery UI and settings/CSS.
- CPanel `npm run build`: passed. Both builds have bundle-size warnings.
- `git diff --check`: clean in both repositories.
- Protected phoneIdentity.js and cpanel/package-lock.json SHA-256 values match
  the pre-edit snapshot. Existing untracked files were not cleaned or reset.
- No staging, commit, push, deployment or live product mutation was performed.
