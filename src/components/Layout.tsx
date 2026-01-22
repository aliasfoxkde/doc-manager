import { Outlet, Link, useLocation } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/documents', label: 'Documents', icon: '📄' },
  { path: '/settings', label: 'Settings', icon: '⚙️' }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { documents } = useDocumentStore();

  return (
    <div className="app-container">
      <nav className="sidebar">
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
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <Link to="/new" className="btn-primary">
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
