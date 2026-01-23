import { Outlet, Link, useLocation } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useState, useEffect, useRef } from 'react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/documents', label: 'Documents', icon: '📄' },
  { path: '/tasks', label: 'Tasks', icon: '✅' },
  { path: '/settings', label: 'Settings', icon: '⚙️' }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { documents } = useDocumentStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }, [location.pathname, mobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Swipe gesture detection
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartRef.current.x;
    const diffY = currentY - touchStartRef.current.y;

    // Only trigger for horizontal swipes (not vertical scrolling)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
      if (diffX > 0 && !mobileMenuOpen) {
        // Swipe right - open menu
        setMobileMenuOpen(true);
      } else if (diffX < 0 && mobileMenuOpen) {
        // Swipe left - close menu
        setMobileMenuOpen(false);
      }
      touchStartRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  // Close menu on backdrop click
  const handleBackdropClick = () => setMobileMenuOpen(false);

  // Close menu on link click
  const handleLinkClick = () => setMobileMenuOpen(false);

  return (
    <div
      className="app-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobile header with hamburger */}
      {isMobile && (
        <header className="mobile-header">
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
          </button>
          <h1 className="mobile-title">📚 Doc Manager</h1>
          <span className="mobile-doc-count">{documents.length}</span>
        </header>
      )}

      {/* Backdrop overlay for mobile */}
      <div
        className={`mobile-backdrop ${mobileMenuOpen ? 'open' : ''}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      <nav
        ref={sidebarRef}
        className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}
      >
        <div className="sidebar-header">
          <h1>📚 Doc Manager</h1>
          <span className="doc-count">{documents.length} documents</span>
        </div>
        <ul className="nav-links">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={location.pathname === item.path ? 'active' : ''}
                onClick={handleLinkClick}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <Link to="/new" className="btn-primary" onClick={handleLinkClick}>
            <span>+</span> New Document
          </Link>
        </div>
      </nav>
      <main className="main-content">
        {children || <Outlet />}
      </main>
    </div>
  );
}
