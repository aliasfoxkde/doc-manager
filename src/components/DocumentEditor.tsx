import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import CKEditorWrapper from './CKEditorWrapper';
import * as documentService from '../services/documentService';
import { getObservability } from '../core/observability';
import { marked } from 'marked';

const obs = getObservability();

export default function DocumentEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { currentDocument, loadDocument, createDocument, saveDocument } = useDocumentStore();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'markdown' | 'yaml' | 'json' | 'text' | 'html' | 'xml'>('markdown');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (id) {
      loadDocument(id);
    } else {
      // New document
      setCurrentDocumentState('');
    }
  }, [id, loadDocument]);

  useEffect(() => {
    if (currentDocument) {
      // Convert markdown to HTML for the rich text editor
      let contentToSet = currentDocument.content;
      if (currentDocument.metadata.type === 'markdown' && !currentDocument.content.startsWith('<')) {
        // It's plain markdown, convert to HTML for the editor
        contentToSet = marked(currentDocument.content);
      }
      setContent(contentToSet);
      setTitle(currentDocument.metadata.title);
      setType(currentDocument.metadata.type);
      setHasUnsavedChanges(false);
    }
  }, [currentDocument]);

  const setCurrentDocumentState = (initialContent: string) => {
    setContent(initialContent);
    // Use timestamp-based title to avoid placeholder detection
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    setTitle(`New Document ${timestamp}`);
    setType('markdown');
  };

  const handleSave = useCallback(async () => {
    if (!content.trim()) {
      alert('Please enter some content before saving.');
      return;
    }

    setIsSaving(true);
    const span = obs.startSpan('DocumentEditor.handleSave');
    try {
      // Convert HTML back to plain text for markdown documents
      let contentToSave = content;
      if ((type === 'markdown' || type === 'html') && content.startsWith('<')) {
        // Strip HTML tags to get plain text
        const tmp = document.createElement('div');
        tmp.innerHTML = content;
        contentToSave = tmp.textContent || tmp.innerText || '';
      }

      if (currentDocument) {
        // Updating existing document
        await saveDocument({
          metadata: { ...currentDocument.metadata, title, type },
          content: contentToSave
        });
        alert('Document saved successfully!');
      } else if (id) {
        // Document still loading
        alert('Please wait for the document to finish loading');
        setIsSaving(false);
        return;
      } else {
        // Creating new document
        const newDoc = await createDocument(title, type);
        await saveDocument({
          metadata: { ...newDoc.metadata, title, type },
          content: contentToSave
        });
        navigate(`/documents/${newDoc.metadata.id}`, { replace: true });
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      obs.error('Failed to save document', error as Error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      obs.endSpan(span);
      setIsSaving(false);
    }
  }, [content, title, type, currentDocument, id, saveDocument, createDocument, navigate]);

  const handleOpenLocal = async () => {
    const span = obs.startSpan('DocumentEditor.handleOpenLocal');
    try {
      const doc = await documentService.openLocalFile();
      if (doc) {
        setContent(doc.content);
        setTitle(doc.metadata.title);
        setType(doc.metadata.type);
        setHasUnsavedChanges(true);
      }
    } catch (error) {
      alert(`Failed to open file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      obs.error('Failed to open local file', error as Error);
    } finally {
      obs.endSpan(span);
    }
  };

  const handleSaveLocal = async () => {
    if (!currentDocument) {
      alert('No document to save.');
      return;
    }

    const span = obs.startSpan('DocumentEditor.handleSaveLocal');
    try {
      await documentService.saveLocalFile({
        metadata: { ...currentDocument.metadata, title, type },
        content
      });
      alert('File saved successfully!');
    } catch (error) {
      alert(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      obs.error('Failed to save file locally', error as Error);
    } finally {
      obs.endSpan(span);
    }
  };

  // Convert markdown for preview
  const renderPreview = () => {
    if (type === 'markdown') {
      // For markdown, we could use a markdown renderer
      return <div className="markdown-preview" style={{ padding: '1rem' }}>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{content}</pre>
      </div>;
    }
    return <div className="content-preview" style={{ padding: '1rem' }}>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{content}</pre>
    </div>;
  };

  return (
    <div className="editor-container">
      <header className="editor-header">
        <div className="editor-title">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setHasUnsavedChanges(true); }}
            placeholder="Document title..."
            className="title-input"
          />
          <select
            value={type}
            onChange={(e) => { setType(e.target.value as any); setHasUnsavedChanges(true); }}
            className="type-select"
          >
            <option value="markdown">Markdown</option>
            <option value="yaml">YAML</option>
            <option value="json">JSON</option>
            <option value="html">HTML</option>
            <option value="xml">XML</option>
            <option value="text">Plain Text</option>
          </select>
          {hasUnsavedChanges && <span className="unsaved-indicator">● Unsaved</span>}
        </div>
        <div className="editor-actions">
          <button
            onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
            className="btn-secondary"
            title={viewMode === 'edit' ? 'Show preview' : 'Show editor'}
          >
            {viewMode === 'edit' ? '👁️ Preview' : '✏️ Edit'}
          </button>
          <button onClick={handleOpenLocal} className="btn-secondary" title="Open local file">
            📂 Open
          </button>
          <button onClick={handleSaveLocal} className="btn-secondary" title="Save to local file">
            💾 Save Local
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary"
          >
            {isSaving ? 'Saving...' : '💾 Save'}
          </button>
        </div>
      </header>

      <div className="editor-content">
        {viewMode === 'edit' ? (
          <CKEditorWrapper
            content={content}
            onChange={(value) => {
              setContent(value);
              setHasUnsavedChanges(true);
            }}
            placeholder="Start typing your document..."
          />
        ) : (
          renderPreview()
        )}
      </div>
    </div>
  );
}
