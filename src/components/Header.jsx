import { useEffect, useMemo, useRef, useState } from 'react';
import CategoriesMegaMenu from './CategoriesMegaMenu';
import CartDrawer from './CartDrawer';
import { Link, localizePath, useRouter } from '../routing/Router';
import { useCart } from '../context/CartContext';
import AboutSubnav from './AboutSubnav';
import { useI18n } from '../i18n/I18nContext';
import { getBrand, getBrandLogo, getProductBySlug, getSiteLogo, hasUploadedBrandLogo, hasUploadedSiteLogo, velvetBrands } from '../data/velvetCatalog';

function LanguageControl({ className = '', onSwitch }) {
  const { copy, switchLanguage } = useI18n();
  return (
    <button
      type="button"
      className={`language-control ${className}`.trim()}
      onClick={() => {
        switchLanguage();
        onSwitch?.();
      }}
      aria-label={copy.header.languageLabel}
    >
      <svg className="language-control__icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3.5 12h17M12 3c2.8 2.6 4.2 5.7 4.2 9s-1.4 6.4-4.2 9c-2.8-2.6-4.2-5.7-4.2-9S9.2 5.6 12 3z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span>{copy.header.language}</span>
    </button>
  );
}

export default function Header({ introActive, solid = false }) {
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const closeTimer = useRef(null);
  const { itemCount } = useCart();
  const { copy, locale } = useI18n();
  const { location, navigate, routePath } = useRouter();
  const [search, setSearch] = useState('');

  const contextBrand = useMemo(() => {
    const brandRoute = routePath.match(/^\/brands\/([^/]+)/);
    if (brandRoute) return getBrand(decodeURIComponent(brandRoute[1]));
    if (routePath !== '/products') {
      if (routePath.startsWith('/products/')) {
        const product = getProductBySlug(decodeURIComponent(routePath.split('/').pop()));
        return product?.brandId ? getBrand(product.brandId) : null;
      }
      return null;
    }
    const slug = new URLSearchParams(location.search).get('brand');
    return slug ? getBrand(slug) : null;
  }, [location.search, routePath]);

  const shopLink = useMemo(() => {
    const brandOnly = routePath.match(/^\/brands\/([^/]+)$/);
    if (brandOnly) {
      const brandSlug = decodeURIComponent(brandOnly[1]);
      return getBrand(brandSlug) ? `/products?brand=${encodeURIComponent(brandSlug)}` : null;
    }
    const categoryOnly = routePath.match(/^\/brands\/([^/]+)\/category\/([^/]+)$/);
    if (categoryOnly) {
      const brandSlug = decodeURIComponent(categoryOnly[1]);
      const categorySlug = decodeURIComponent(categoryOnly[2]);
      return getBrand(brandSlug)
        ? `/products?brand=${encodeURIComponent(brandSlug)}&category=${encodeURIComponent(categorySlug)}`
        : null;
    }
    return null;
  }, [routePath]);

  const siteLogo = getSiteLogo();
  const contextBrandLogo = contextBrand ? getBrandLogo(contextBrand.slug, locale) : '';
  const managedSiteLogo = !contextBrand && hasUploadedSiteLogo();
  const managedBrandLogo = contextBrand && hasUploadedBrandLogo(contextBrand.slug, locale);

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    if (query) {
      navigate(localizePath(`/products?search=${encodeURIComponent(query)}`, locale));
      setMobileOpen(false);
    }
  };

  const hoverCapable = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const openBrandsOnHover = () => {
    if (!hoverCapable() || window.innerWidth <= 900) return;
    window.clearTimeout(closeTimer.current);
    setBrandsOpen(true);
    setAboutOpen(false);
  };

  const scheduleBrandsClose = () => {
    if (!hoverCapable() || window.innerWidth <= 900) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setBrandsOpen(false), 220);
  };

  const cancelBrandsClose = () => window.clearTimeout(closeTimer.current);

  const toggleBrands = () => {
    window.clearTimeout(closeTimer.current);
    if (hoverCapable() && window.innerWidth > 900) {
      setBrandsOpen(true);
      setAboutOpen(false);
      return;
    }
    setBrandsOpen((value) => !value);
    setAboutOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  const goBrand = (slug) => {
    navigate(localizePath(`/brands/${slug}`, locale));
    closeMobile();
    setBrandsOpen(false);
  };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', mobileOpen);
    return () => document.body.classList.remove('mobile-nav-open');
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > lastY.current && y > 160 && !brandsOpen && !aboutOpen && !mobileOpen);
      lastY.current = y;
    };
    const onKey = (event) => event.key === 'Escape' && (setBrandsOpen(false), setAboutOpen(false), setMobileOpen(false));
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, [aboutOpen, brandsOpen, mobileOpen]);

  return (
    <header className={`site-header ${solid ? 'site-header--solid' : ''} ${introActive ? 'is-entering' : ''} ${hidden ? 'is-hidden' : ''} ${brandsOpen || aboutOpen || mobileOpen ? 'is-open' : ''}`}>
      <div className="nav-bar">
        <Link
          className={`logo ${contextBrand ? 'logo--brand' : 'logo--velvet'}${managedSiteLogo ? ' logo--managed logo--managed-site' : ''}${managedBrandLogo ? ' logo--managed' : ''}${!contextBrand ? ' logo--velvet-badge' : ''}`}
          to={contextBrand ? localizePath(`/brands/${contextBrand.slug}`, locale) : '/'}
          style={contextBrand && !managedBrandLogo ? { '--brand-accent': contextBrand.accent } : undefined}
          aria-label={contextBrand ? contextBrand.name[locale] : 'VELVET'}
        >
          {!contextBrand && <span className="logo__badge" aria-hidden="true" />}
          {contextBrand ? (
            contextBrandLogo ? (
              <img className={`logo__img logo__img--brand${managedBrandLogo ? ' logo__img--managed' : ''}`} src={contextBrandLogo} alt={contextBrand.name[locale]} />
            ) : (
              <span>{contextBrand.name[locale]}</span>
            )
          ) : siteLogo ? (
            <img className={`logo__img${managedSiteLogo ? ' logo__img--managed logo__img--managed-site' : ''}`} src={siteLogo} alt="VELVET" />
          ) : (
            <span className="logo__wordmark">VELVET</span>
          )}
        </Link>

        <nav className="main-nav main-nav--desktop" aria-label={copy.header.nav}>
          <button
            className="nav-link"
            type="button"
            aria-expanded={brandsOpen}
            onMouseEnter={openBrandsOnHover}
            onMouseLeave={scheduleBrandsClose}
            onFocus={() => { if (hoverCapable()) openBrandsOnHover(); }}
            onBlur={scheduleBrandsClose}
            onClick={toggleBrands}
          >
            {copy.header.categories} <i className="chevron" />
          </button>
          <button className="nav-link" type="button" aria-expanded={aboutOpen} onClick={() => { setAboutOpen((value) => !value); setBrandsOpen(false); }}>
            {copy.header.about} <i className="chevron" />
          </button>
          <Link className="nav-link" to="/contact">{copy.header.contact}</Link>
          {shopLink && <Link className="nav-link" to={shopLink}>{copy.header.shop}</Link>}
        </nav>

        <div className="header-actions">
          <form className="search-pill" onSubmit={submitSearch}>
            <span>{copy.header.search}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={copy.header.searchLabel} />
            <button className="search-pill__submit" type="submit" aria-label={copy.header.searchLabel}><i /></button>
          </form>
          <LanguageControl className="language-control--header" />
          <button
            className="header-icon-button header-cart-link"
            type="button"
            aria-label={`${copy.header.cart}: ${itemCount}`}
            onClick={() => setCartOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3.5 4.5h2l1.8 10.1a2 2 0 0 0 2 1.7h7.9a2 2 0 0 0 1.9-1.5l1.2-6.3H6.2" />
              <circle cx="9.4" cy="19.2" r="1.1" />
              <circle cx="17.4" cy="19.2" r="1.1" />
            </svg>
            {itemCount > 0 && <span className="header-cart-count">{itemCount > 99 ? '99+' : itemCount}</span>}
          </button>
          <button className="header-icon-button header-icon-button--account" type="button" aria-label={copy.header.account}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.6" />
              <path d="M5.2 20c.6-4 3-6.1 6.8-6.1s6.2 2.1 6.8 6.1" />
            </svg>
          </button>
        </div>

        <button
          className={`menu-toggle${mobileOpen ? ' is-open' : ''}`}
          type="button"
          aria-label={copy.header.menu}
          aria-expanded={mobileOpen}
          onClick={() => { setMobileOpen((value) => !value); setBrandsOpen(false); setAboutOpen(false); }}
        >
          <span /><span /><span />
        </button>
      </div>

      <div className={`mobile-drawer${mobileOpen ? ' is-open' : ''}`} aria-hidden={!mobileOpen}>
        <form className="mobile-drawer__search" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="mobile-header-search">{copy.header.searchLabel}</label>
          <input
            id="mobile-header-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.header.search}
            type="search"
          />
          <button type="submit" aria-label={copy.header.searchLabel}>{copy.header.search}</button>
        </form>

        <div className="mobile-drawer__section">
          <p className="mobile-drawer__label">{copy.header.brands || copy.header.categories}</p>
          <div className="mobile-drawer__brands">
            {velvetBrands.map((brand) => (
              <button type="button" key={brand.slug} onClick={() => goBrand(brand.slug)}>
                {brand.name[locale]}
              </button>
            ))}
          </div>
        </div>

        <nav className="mobile-drawer__links" aria-label={copy.header.nav}>
          <Link to="/about" onClick={closeMobile}>{copy.header.about}</Link>
          <Link to="/contact" onClick={closeMobile}>{copy.header.contact}</Link>
          {shopLink && <Link to={shopLink} onClick={closeMobile}>{copy.header.shop}</Link>}
          <Link to="/products" onClick={closeMobile}>{copy.header.products || copy.products.products}</Link>
        </nav>

        <div className="mobile-drawer__footer">
          <LanguageControl onSwitch={closeMobile} />
          <button type="button" className="mobile-drawer__action" onClick={() => { setCartOpen(true); closeMobile(); }}>
            {copy.header.cart}
            {itemCount > 0 ? ` (${itemCount})` : ''}
          </button>
          <button type="button" className="mobile-drawer__action" aria-label={copy.header.account}>
            {copy.header.account}
          </button>
        </div>
      </div>

      <div className="mega-menu-zone" onMouseEnter={cancelBrandsClose} onMouseLeave={scheduleBrandsClose}>
        <CategoriesMegaMenu open={brandsOpen} onClose={() => setBrandsOpen(false)} brand={contextBrand} />
      </div>
      <AboutSubnav open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </header>
  );
}
