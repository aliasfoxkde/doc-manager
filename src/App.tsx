import { Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from './stores/themeStore';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import DocumentEditor from './components/DocumentEditor';
import DocumentList from './components/DocumentList';
import Settings from './components/Settings';
import SyncStatus from './components/SyncStatus';

function App() {
  const { theme } = useThemeStore();

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/documents" element={<DocumentList />} />
        <Route path="/documents/:id" element={<DocumentEditor />} />
        <Route path="/new" element={<DocumentEditor />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SyncStatus />
    </Layout>
  );
}

export default App;
