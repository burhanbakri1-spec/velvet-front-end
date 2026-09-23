import Header from './Header';
import Footer from './Footer';

export default function StoreLayout({ children, company = false, solid }) {
  const headerSolid = typeof solid === 'boolean' ? solid : !company;
  return (
    <>
      <Header introActive={false} solid={headerSolid} />
      <main className={`store-main ${company ? 'store-main--company' : ''}`}>{children}</main>
      <Footer />
    </>
  );
}
