import { RouterProvider, useRouter } from './routing/Router';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { useEffect } from 'react';
import { CartProvider } from './context/CartContext';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CartPage from './pages/CartPage';
import AboutPage from './pages/AboutPage';
import NewsPage from './pages/NewsPage';
import ContactPage from './pages/ContactPage';
import CategoryPage from './pages/CategoryPage';
import StoreLayout from './components/StoreLayout';

function RouteView() {
  const { routePath } = useRouter();
  const { copy } = useI18n();

  useEffect(() => {
    const key = routePath === '/' ? 'home' : routePath.split('/')[1];
    document.title = `${copy.meta[key] || copy.meta.site} | PLAY`;
  }, [copy, routePath]);

  if (routePath === '/') return <HomePage />;

  let page;
  if (routePath.startsWith('/categories/')) {
    const slug = decodeURIComponent(routePath.split('/').pop());
    page = <CategoryPage key={slug} slug={slug} />;
  }
  else if (routePath === '/products') page = <ProductsPage />;
  else if (routePath.startsWith('/products/')) {
    const slug = decodeURIComponent(routePath.split('/').pop());
    page = <ProductDetailsPage key={slug} slug={slug} />;
  }
  else if (routePath === '/cart') page = <CartPage />;
  else if (routePath === '/about') page = <AboutPage />;
  else if (routePath === '/news') page = <NewsPage />;
  else if (routePath === '/contact') page = <ContactPage />;
  else page = <section className="store-not-found"><h1>404</h1><p>{copy.detail.missing}</p></section>;

  return (
    <StoreLayout company={routePath.startsWith('/categories/') || ['/about', '/news', '/contact'].includes(routePath)}>{page}</StoreLayout>
  );
}

export default function App() {
  return <RouterProvider><I18nProvider><CartProvider><RouteView /></CartProvider></I18nProvider></RouterProvider>;
}
