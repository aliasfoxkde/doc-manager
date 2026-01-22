import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const navigate = useNavigate();
  const { documents, filteredDocuments, loadDocuments, searchQuery, setSearchQuery } = useDocumentStore();

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h2>Welcome to Doc Manager</h2>
          <p>Your local document management system with cloud sync</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/new')}>
          + New Document
        </button>
      </header>

      <section className="dashboard-section">
        <h3>Quick Search</h3>
        <input
          type="search"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && filteredDocuments.length > 0 && (
          <div className="search-results">
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="search-result-item" onClick={() => navigate(`/documents/${doc.id}`)}>
                <span className="doc-icon">{getDocIcon(doc.type)}</span>
                <div>
                  <div className="doc-title">{doc.title}</div>
                  <div className="doc-meta">
                    {formatDistanceToNow(new Date(doc.updatedAt))} ago
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-header">
          <h3>Recent Documents</h3>
          <button className="btn-link" onClick={() => navigate('/documents')}>View All →</button>
        </div>
        <div className="doc-grid">
          {recentDocs.map((doc) => (
            <div key={doc.id} className="doc-card" onClick={() => navigate(`/documents/${doc.id}`)}>
              <span className="doc-card-icon">{getDocIcon(doc.type)}</span>
              <div className="doc-card-content">
                <h4>{doc.title}</h4>
                <p>{formatDistanceToNow(new Date(doc.updatedAt))} ago</p>
                {doc.tags && doc.tags.length > 0 && (
                  <div className="doc-tags">
                    {doc.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              {!doc.isSynced && <span className="sync-badge">Unsynced</span>}
            </div>
          ))}
          {recentDocs.length === 0 && (
            <div className="empty-state">
              <p>No documents yet. Create your first document!</p>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-section">
        <h3>Quick Actions</h3>
        <div className="quick-actions">
          <button className="action-card" onClick={() => navigate('/new')}>
            <span className="action-icon">📝</span>
            <span>New Document</span>
          </button>
          <button className="action-card" onClick={() => navigate('/settings')}>
            <span className="action-icon">🔄</span>
            <span>Sync Settings</span>
          </button>
          <button className="action-card" onClick={() => navigate('/documents')}>
            <span className="action-icon">📂</span>
            <span>Browse All</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function getDocIcon(type: string): string {
  switch (type) {
    case 'markdown': return '📝';
    case 'json': return '🔧';
    case 'yaml': return '⚙️';
    default: return '📄';
  }
}
