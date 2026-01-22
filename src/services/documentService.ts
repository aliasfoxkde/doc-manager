import { openDB } from 'idb';
import { Document, DocumentMetadata } from '../types';
import { nanoid } from 'nanoid';

const DB_NAME = 'doc-manager';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME, { keyPath: 'metadata.id' });
    db.createObjectStore('sync-state', { keyPath: 'id' });
  },
});

// IndexedDB operations
async function getAllDocuments(): Promise<DocumentMetadata[]> {
  const db = await dbPromise;
  const docs = await db.getAll(STORE_NAME);
  return docs.map((d: Document) => d.metadata);
}

async function getDocument(id: string): Promise<Document> {
  const db = await dbPromise;
  const doc = await db.get(STORE_NAME, id);
  if (!doc) throw new Error('Document not found');
  return doc;
}

async function createDocument(title: string, type: string): Promise<Document> {
  const metadata: DocumentMetadata = {
    id: nanoid(),
    title,
    type: type as any,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    size: 0,
    isSynced: false
  };

  const doc: Document = { metadata, content: '' };

  const db = await dbPromise;
  await db.put(STORE_NAME, doc);

  return doc;
}

async function saveDocument(document: Document): Promise<Document> {
  const metadata: DocumentMetadata = {
    ...document.metadata,
    updatedAt: new Date().toISOString(),
    size: new Blob([document.content]).size
  };

  const updated: Document = { ...document, metadata };

  const db = await dbPromise;
  await db.put(STORE_NAME, updated);

  return updated;
}

async function deleteDocument(id: string): Promise<void> {
  const db = await dbPromise;
  await db.delete(STORE_NAME, id);
}

// Sync operations (placeholder for future Cloudflare/Git integration)
async function syncDocuments(): Promise<void> {
  // TODO: Implement sync with Cloudflare Workers/GitHub/Local NAS
  const db = await dbPromise;
  await db.put('sync-state', {
    id: 'last-sync',
    timestamp: new Date().toISOString()
  });
}

// File System Access API for local file operations
async function openLocalFile(): Promise<Document | null> {
  if (!('showOpenFilePicker' in window)) {
    throw new Error('File System Access API not supported');
  }

  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{
        description: 'Documents',
        accept: {
          'text/markdown': ['.md'],
          'text/plain': ['.txt'],
          'application/json': ['.json'],
          'application/x-yaml': ['.yaml', '.yml']
        }
      }],
      multiple: false
    });

    const file = await handle.getFile();
    const content = await file.text();

    const metadata: DocumentMetadata = {
      id: nanoid(),
      title: file.name,
      type: getFileType(file.name),
      createdAt: new Date().toISOString(),
      updatedAt: file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString(),
      size: file.size,
      path: file.name,
      isSynced: false
    };

    return { metadata, content };
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null;
    throw err;
  }
}

async function saveLocalFile(document: Document): Promise<void> {
  if (!('showSaveFilePicker' in window)) {
    throw new Error('File System Access API not supported');
  }

  const ext = getFileExtension(document.metadata.type);
  const handle = await (window as any).showSaveFilePicker({
    suggestedName: `${document.metadata.title}${ext}`,
    types: [{
      description: 'Documents',
      accept: { 'text/markdown': ['.md'], 'text/plain': ['.txt'] }
    }]
  });

  const writable = await handle.createWritable();
  await writable.write(document.content);
  await writable.close();
}

function getFileType(filename: string): DocumentMetadata['type'] {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'md': return 'markdown';
    case 'json': return 'json';
    case 'yaml':
    case 'yml': return 'yaml';
    default: return 'text';
  }
}

function getFileExtension(type: DocumentMetadata['type']): string {
  switch (type) {
    case 'markdown': return '.md';
    case 'json': return '.json';
    case 'yaml': return '.yaml';
    default: return '.txt';
  }
}

export {
  getAllDocuments,
  getDocument,
  createDocument,
  saveDocument,
  deleteDocument,
  syncDocuments,
  openLocalFile,
  saveLocalFile
};
