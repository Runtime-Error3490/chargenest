import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function Layout({ children, showFooter = true }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}

export function FullScreenLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}

export default Layout;
