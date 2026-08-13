import { useEffect, useMemo, useRef, useState } from 'react';
import CategoriesMegaMenu from './CategoriesMegaMenu';
import CartDrawer from './CartDrawer';
import { Link, localizePath, useRouter } from '../routing/Router';
import { useCart } from '../context/CartContext';
import AboutSubnav from './AboutSubnav';
import { useI18n } from '../i18n/I18nContext';
import { getPlatformMedia } from '../data/platformContent';
import { getBrand, getBrandLogo, getProductBySlug } from '../data/velvetCatalog';

export default function Header({ introActive, solid = false }) {
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const closeTimer = useRef(null);
  const { itemCount } = useCart();
  const { copy, locale, switchLanguage } = useI18n();
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

  const siteLogo = getPlatformMedia('site.logo');
  const contextBrandLogo = contextBrand ? getBrandLogo(contextBrand.slug) : '';

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    if (query) navigate(localizePath(`/products?search=${encodeURIComponent(query)}`, locale));
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
    if (mobileOpen) setMobileOpen(false);
  };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

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
      <div className="utility-bar">
        <span>{copy.header.tagline}</span>
        <button type="button" onClick={() => switchLanguage()} aria-label={copy.header.languageLabel}>{copy.header.language}</button>
      </div>
      <div className="nav-bar">
        <Link
          className={`logo ${contextBrand ? 'logo--brand' : ''}`}
          to={contextBrand ? localizePath(`/brands/${contextBrand.slug}`, locale) : '/'}
          style={contextBrand ? { '--brand-accent': contextBrand.accent } : undefined}
          aria-label={contextBrand ? contextBrand.name[locale] : 'VELVET'}
        >
          {contextBrand ? (
            contextBrandLogo ? (
              <img className="logo__img logo__img--brand" src={contextBrandLogo} alt={contextBrand.name[locale]} />
            ) : (
              <span>{contextBrand.name[locale]}</span>
            )
          ) : siteLogo ? (
            <img className="logo__img" src={siteLogo} alt="VELVET" />
          ) : (
            <span>VELVET</span>
          )}
        </Link>
        <nav className={`main-nav ${mobileOpen ? 'is-open' : ''}`} aria-label={copy.header.nav}>
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
          <button className="nav-link" type="button" aria-expanded={aboutOpen} onClick={() => { setAboutOpen((value) => !value); setBrandsOpen(false); if (mobileOpen) setMobileOpen(false); }}>
            {copy.header.about} <i className="chevron" />
          </button>
          <Link className="nav-link" to={contextBrand ? `/products?brand=${contextBrand.slug}` : '/products'} onClick={() => setMobileOpen(false)}>{copy.header.products}</Link>
        </nav>
        <div className="header-actions">
          <form className="search-pill" onSubmit={submitSearch}>
            <span>{copy.header.search}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label={copy.header.searchLabel} />
            <button className="search-pill__submit" type="submit" aria-label={copy.header.searchLabel}><i /></button>
          </form>
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
          <button className="header-icon-button" type="button" aria-label={copy.header.account}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.6" />
              <path d="M5.2 20c.6-4 3-6.1 6.8-6.1s6.2 2.1 6.8 6.1" />
            </svg>
          </button>
        </div>
        <button className="menu-toggle" type="button" aria-label={copy.header.menu} aria-expanded={mobileOpen} onClick={() => { setMobileOpen((value) => !value); setBrandsOpen(false); setAboutOpen(false); }}>
          <span /><span />
        </button>
      </div>
      <div className="mega-menu-zone" onMouseEnter={cancelBrandsClose} onMouseLeave={scheduleBrandsClose}>
        <CategoriesMegaMenu open={brandsOpen} onClose={() => setBrandsOpen(false)} brand={contextBrand} />
      </div>
      <AboutSubnav open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </header>
  );
}
