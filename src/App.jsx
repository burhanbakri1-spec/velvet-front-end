import { RouterProvider, useRouter } from './routing/Router';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { useEffect } from 'react';
import { CartProvider } from './context/CartContext';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import AboutPage from './pages/AboutPage';
import NewsPage from './pages/NewsPage';
import ContactPage from './pages/ContactPage';
import VlogsPage from './pages/VlogsPage';
import CategoryPage from './pages/CategoryPage';
import BrandPage from './pages/BrandPage';
import BrandCategoryPage from './pages/BrandCategoryPage';
import StoreLayout from './components/StoreLayout';

function RouteView() {
  const { routePath } = useRouter();
  const { copy } = useI18n();

  useEffect(() => {
    const key = routePath === '/' ? 'home' : routePath.split('/')[1];
    document.title = `${copy.meta[key] || copy.meta.site} | VELVET`;
  }, [copy, routePath]);

  if (routePath === '/') return <HomePage />;

  let page;
  const brandCategorySubRoute = routePath.match(/^\/brands\/([^/]+)\/category\/([^/]+)\/subcategory\/([^/]+)$/);
  const brandCategoryRoute = routePath.match(/^\/brands\/([^/]+)\/category\/([^/]+)$/);
  if (brandCategorySubRoute) {
    const brandSlug = decodeURIComponent(brandCategorySubRoute[1]);
    const categorySlug = decodeURIComponent(brandCategorySubRoute[2]);
    const subcategorySlug = decodeURIComponent(brandCategorySubRoute[3]);
    page = (
      <BrandCategoryPage
        key={routePath}
        slug={brandSlug}
        categorySlug={categorySlug}
        subcategorySlug={subcategorySlug}
      />
    );
  }
  else if (brandCategoryRoute) {
    const brandSlug = decodeURIComponent(brandCategoryRoute[1]);
    const categorySlug = decodeURIComponent(brandCategoryRoute[2]);
    page = <BrandCategoryPage key={routePath} slug={brandSlug} categorySlug={categorySlug} />;
  }
  else if (routePath.match(/^\/brands\/[^/]+$/)) {
    const slug = decodeURIComponent(routePath.split('/').pop());
    page = <BrandPage key={slug} slug={slug} />;
  }
  else if (routePath.startsWith('/categories/')) {
    const slug = decodeURIComponent(routePath.split('/').pop());
    page = <CategoryPage key={slug} slug={slug} />;
  }
  else if (routePath === '/products') page = <ProductsPage />;
  else if (routePath.startsWith('/products/')) {
    const slug = decodeURIComponent(routePath.split('/').pop());
    // Keep a stable component instance so same-subcategory product switches
    // can update client-side without a full remount/reload.
    page = <ProductDetailsPage slug={slug} />;
  }
  else if (routePath === '/cart') page = <CartPage />;
  else if (routePath === '/checkout') page = <CheckoutPage />;
  else if (routePath === '/about') page = <AboutPage />;
  else if (routePath === '/news') page = <NewsPage />;
  else if (routePath === '/contact') page = <ContactPage />;
  else if (routePath === '/vlogs') page = <VlogsPage />;
  else page = <section className="store-not-found"><h1>404</h1><p>{copy.detail.missing}</p></section>;

  return (
    <StoreLayout company={routePath.startsWith('/categories/') || ['/about', '/news', '/contact', '/vlogs'].includes(routePath)}>{page}</StoreLayout>
  );
}

export default function App() {
  return <RouterProvider><I18nProvider><CartProvider><RouteView /></CartProvider></I18nProvider></RouterProvider>;
}
