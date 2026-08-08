import Header from './Header';
import Footer from './Footer';

export default function StoreLayout({ children, company = false }) {
  return (
    <>
      <Header introActive={false} solid={!company} />
      <main className={`store-main ${company ? 'store-main--company' : ''}`}>{children}</main>
      <Footer />
    </>
  );
}
