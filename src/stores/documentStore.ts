import { create } from 'zustand';
import { Document, DocumentMetadata, SyncStatus } from '../types';
import * as documentService from '../services/documentService';

interface DocumentState {
  documents: DocumentMetadata[];
  currentDocument: Document | null;
  isLoading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  searchQuery: string;
  filteredDocuments: DocumentMetadata[];

  // Actions
  loadDocuments: () => Promise<void>;
  loadDocument: (id: string) => Promise<void>;
  createDocument: (title: string, type: string) => Promise<Document>;
  saveDocument: (document: Document) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  syncDocuments: () => Promise<void>;
  setCurrentDocument: (document: Document | null) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  currentDocument: null,
  isLoading: false,
  error: null,
  syncStatus: { connected: false, lastSync: null, pendingChanges: 0 },
  searchQuery: '',
  filteredDocuments: [],

  loadDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const docs = await documentService.getAllDocuments();
      set({ documents: docs, filteredDocuments: docs, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load documents', isLoading: false });
    }
  },

  loadDocument: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const doc = await documentService.getDocument(id);
      set({ currentDocument: doc, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load document', isLoading: false });
    }
  },

  createDocument: async (title: string, type: string) => {
    set({ isLoading: true, error: null });
    try {
      const doc = await documentService.createDocument(title, type);
      set((state) => ({
        documents: [...state.documents, doc.metadata],
        currentDocument: doc,
        isLoading: false
      }));
      return doc;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create document', isLoading: false });
      throw error;
    }
  },

  saveDocument: async (document: Document) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await documentService.saveDocument(document);
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === updated.metadata.id ? updated.metadata : d
        ),
        currentDocument: updated,
        isLoading: false
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save document', isLoading: false });
    }
  },

  deleteDocument: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await documentService.deleteDocument(id);
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
        currentDocument: state.currentDocument?.metadata.id === id ? null : state.currentDocument,
        isLoading: false
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete document', isLoading: false });
    }
  },

  setSearchQuery: (query: string) => {
    const { documents } = get();
    const filtered = query
      ? documents.filter((d) =>
          d.title.toLowerCase().includes(query.toLowerCase()) ||
          d.tags?.some((t) => t.toLowerCase().includes(query.toLowerCase()))
        )
      : documents;
    set({ searchQuery: query, filteredDocuments: filtered });
  },

  syncDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      await documentService.syncDocuments();
      const docs = await documentService.getAllDocuments();
      set({
        documents: docs,
        filteredDocuments: get().searchQuery
          ? docs.filter((d) =>
              d.title.toLowerCase().includes(get().searchQuery.toLowerCase())
            )
          : docs,
        syncStatus: {
          connected: true,
          lastSync: new Date().toISOString(),
          pendingChanges: 0
        },
        isLoading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Sync failed',
        isLoading: false,
        syncStatus: { ...get().syncStatus, connected: false }
      });
    }
  },

  setCurrentDocument: (document: Document | null) => {
    set({ currentDocument: document });
  }
}));
