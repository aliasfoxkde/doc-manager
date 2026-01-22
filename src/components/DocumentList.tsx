import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { formatDistanceToNow } from 'date-fns';

export default function DocumentList() {
  const navigate = useNavigate();
  const { filteredDocuments, loadDocuments, searchQuery } = useDocumentStore();

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const groupedDocs = filteredDocuments.reduce((acc, doc) => {
    const key = doc.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {} as Record<string, typeof filteredDocuments>);

  return (
    <div className="document-list">
      <header className="list-header">
        <h2>Documents</h2>
        {searchQuery && <p>Search results for "{searchQuery}"</p>}
      </header>

      {Object.entries(groupedDocs).map(([type, docs]) => (
        <section key={type} className="doc-section">
          <h3>{type.toUpperCase()} ({docs.length})</h3>
          <div className="doc-list-items">
            {docs.map((doc) => (
              <div key={doc.id} className="doc-list-item" onClick={() => navigate(`/documents/${doc.id}`)}>
                <span className="doc-icon">{getDocIcon(doc.type)}</span>
                <div className="doc-info">
                  <h4>{doc.title}</h4>
                  <div className="doc-meta">
                    <span>Updated {formatDistanceToNow(new Date(doc.updatedAt))} ago</span>
                    <span>•</span>
                    <span>{formatBytes(doc.size)}</span>
                  </div>
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="doc-tags">
                      {doc.tags.map((tag) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="doc-status">
                  {!doc.isSynced && <span className="sync-badge">Unsynced</span>}
                  {doc.path && <span className="local-badge">Local</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {filteredDocuments.length === 0 && (
        <div className="empty-state">
          <p>{searchQuery ? 'No documents match your search.' : 'No documents yet. Create your first document!'}</p>
          <button onClick={() => navigate('/new')} className="btn-primary">+ New Document</button>
        </div>
      )}
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
