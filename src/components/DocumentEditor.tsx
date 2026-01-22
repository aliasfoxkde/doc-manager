import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import Editor from '@monaco-editor/react';
import * as documentService from '../services/documentService';
import { getObservability } from '../core/observability';

const obs = getObservability();

export default function DocumentEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { currentDocument, loadDocument, createDocument, saveDocument } = useDocumentStore();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'markdown' | 'yaml' | 'json' | 'text'>('markdown');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      setContent(currentDocument.content);
      setTitle(currentDocument.metadata.title);
      setType(currentDocument.metadata.type);
      setHasUnsavedChanges(false);
    }
  }, [currentDocument]);

  const setCurrentDocumentState = (initialContent: string) => {
    setContent(initialContent);
    setTitle('Untitled Document');
    setType('markdown');
  };

  const handleSave = useCallback(async () => {
    if (!content.trim()) return;

    setIsSaving(true);
    const span = obs.startSpan('DocumentEditor.handleSave');
    try {
      if (currentDocument || id) {
        await saveDocument({
          metadata: { ...currentDocument!.metadata, title, type },
          content
        });
      } else {
        const newDoc = await createDocument(title, type);
        await saveDocument({
          metadata: { ...newDoc.metadata, title, type },
          content
        });
        navigate(`/documents/${newDoc.metadata.id}`, { replace: true });
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      obs.error('Failed to save document', error as Error);
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
      obs.error('Failed to open local file', error as Error);
    } finally {
      obs.endSpan(span);
    }
  };

  const handleSaveLocal = async () => {
    const span = obs.startSpan('DocumentEditor.handleSaveLocal');
    try {
      await documentService.saveLocalFile({
        metadata: { ...currentDocument!.metadata, title, type },
        content
      });
    } catch (error) {
      obs.error('Failed to save file locally', error as Error);
    } finally {
      obs.endSpan(span);
    }
  };

  const getLanguage = () => {
    switch (type) {
      case 'markdown': return 'markdown';
      case 'json': return 'json';
      case 'yaml': return 'yaml';
      default: return 'plaintext';
    }
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
            <option value="text">Plain Text</option>
          </select>
          {hasUnsavedChanges && <span className="unsaved-indicator">● Unsaved</span>}
        </div>
        <div className="editor-actions">
          <button onClick={handleOpenLocal} className="btn-secondary">
            📂 Open Local
          </button>
          <button onClick={handleSaveLocal} className="btn-secondary">
            💾 Save Local
          </button>
          <button onClick={handleSave} disabled={isSaving || !content.trim()} className="btn-primary">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      <div className="editor-content">
        <Editor
          value={content}
          onChange={(value) => {
            setContent(value || '');
            setHasUnsavedChanges(true);
          }}
          language={getLanguage()}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true
          }}
          height="calc(100vh - 140px)"
        />
      </div>
    </div>
  );
}
