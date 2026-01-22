import { openDB } from 'idb';
import { Document, DocumentMetadata } from '../types';
import { nanoid } from 'nanoid';
import { fileWatcherClient, FileWatcherFile } from './fileWatcherClient';

const DB_NAME = 'doc-manager';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME, { keyPath: 'metadata.id' });
    db.createObjectStore('sync-state', { keyPath: 'id' });
  },
});

// Get all documents from both IndexedDB and file watcher
async function getAllDocuments(): Promise<DocumentMetadata[]> {
  const db = await dbPromise;
  const indexedDocs = await db.getAll(STORE_NAME);
  const docsFromDB = indexedDocs.map((d: Document) => d.metadata);

  // Try to fetch from file watcher
  try {
    const watcherFiles = await fileWatcherClient.getAllFiles();
    const docsFromWatcher: DocumentMetadata[] = watcherFiles.map((file) => ({
      id: `fw-${file.id}`,
      title: file.filename.replace(/\.[^/.]+$/, ''), // Remove extension
      type: file.type,
      createdAt: file.created,
      updatedAt: file.modified,
      size: file.size,
      tags: [],
      path: `${file.category}/${file.filename}`,
      isSynced: true,
      source: 'filewatcher' as any
    }));

    // Merge both sources, preferring file watcher versions for files that exist in both
    const mergedDocs = [...docsFromWatcher];
    const watcherIds = new Set(watcherFiles.map(f => `fw-${f.id}`));

    for (const dbDoc of docsFromDB) {
      // Only add DB docs that aren't from file watcher
      if (!dbDoc.path || !dbDoc.path.startsWith('documents/')) {
        mergedDocs.push(dbDoc);
      }
    }

    return mergedDocs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    // File watcher not available, return only IndexedDB docs
    return docsFromDB;
  }
}

async function getDocument(id: string): Promise<Document> {
  // Check if it's from file watcher (starts with fw-)
  if (id.startsWith('fw-')) {
    const fileWatcherId = id.substring(3); // Remove fw- prefix
    const parts = fileWatcherId.split('/');
    const category = parts[0];
    const filename = parts.slice(1).join('/');

    const fileData = await fileWatcherClient.getFile(category, filename);

    // Convert to Document format
    const docType = filename.split('.').pop() || 'markdown';
    return {
      metadata: {
        id: `fw-${fileWatcherId}`,
        title: filename.replace(/\.[^/.]+$/, ''),
        type: docType as any,
        createdAt: fileData.metadata.created,
        updatedAt: fileData.metadata.modified,
        size: fileData.metadata.size,
        tags: [],
        path: `${category}/${filename}`,
        isSynced: true,
        source: 'filewatcher' as any
      },
      content: fileData.content
    };
  }

  // Otherwise get from IndexedDB
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

// Sync operations - Implementation note: Sync with Cloudflare Workers/GitHub/Local NAS
// This is a placeholder for future sync functionality
async function syncDocuments(): Promise<void> {
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
