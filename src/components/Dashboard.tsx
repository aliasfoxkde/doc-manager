import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { formatDistanceToNow } from 'date-fns';
import { DocumentMetadata } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    documents,
    filteredDocuments,
    loadDocuments,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode
  } = useDocumentStore();

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Group documents by folder
  const folderGroups = useMemo(() => {
    const groups: Record<string, DocumentMetadata[]> = {};

    documents.forEach(doc => {
      const folder = doc.path?.split('/')[0] || 'Uncategorized';
      if (!groups[folder]) {
        groups[folder] = [];
      }
      groups[folder].push(doc);
    });

    // Sort folders by name and documents within by date
    return Object.entries(groups)
      .map(([name, docs]) => ({
        name,
        documents: docs.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [documents]);

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
              <div
                key={doc.id}
                className="search-result-item"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                <span className="doc-icon">{getDocIcon(doc.type)}</span>
                <div>
                  <div className="doc-title">{doc.title}</div>
                  <div className="doc-meta">
                    {doc.path?.split('/')[0] && (
                      <span className="doc-folder">{doc.path.split('/')[0]}</span>
                    )}
                    {' • '}
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
          <h3>Documents ({documents.length})</h3>
          <div className="view-controls">
            <button
              className={`view-toggle ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
            <button
              className={`view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="empty-state">
            <p>No documents yet. Create your first document!</p>
          </div>
        ) : (
          <div className={`documents-container view-${viewMode}`}>
            {viewMode === 'grid' ? (
              // Grid view with folder sections
              folderGroups.map((group) => (
                <div key={group.name} className="folder-section">
                  <h4 className="folder-name">{getFolderIcon(group.name)} {group.name}</h4>
                  <div className="doc-grid">
                    {group.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="doc-card"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <span className="doc-card-icon">{getDocIcon(doc.type)}</span>
                        <div className="doc-card-content">
                          <h4>{doc.title}</h4>
                          <p>{formatDistanceToNow(new Date(doc.updatedAt))} ago</p>
                        </div>
                        {!doc.isSynced && <span className="sync-badge">Unsynced</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // List view - all documents in a table
              <div className="doc-list">
                {folderGroups.map((group) => (
                  <div key={group.name} className="list-folder-section">
                    <h4 className="list-folder-header">{getFolderIcon(group.name)} {group.name} ({group.documents.length})</h4>
                    {group.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="doc-list-item"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <span className="doc-list-icon">{getDocIcon(doc.type)}</span>
                        <div className="doc-list-info">
                          <div className="doc-list-title">{doc.title}</div>
                          <div className="doc-list-meta">
                            {formatDistanceToNow(new Date(doc.updatedAt))} ago
                          </div>
                        </div>
                        {!doc.isSynced && <span className="sync-badge-small">Unsynced</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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

function getFolderIcon(folder: string): string {
  switch (folder.toLowerCase()) {
    case 'documents': return '📄';
    case 'knowledge': return '🧠';
    case 'research': return '🔬';
    case 'history': return '📜';
    case 'logs': return '📋';
    default: return '📁';
  }
}
