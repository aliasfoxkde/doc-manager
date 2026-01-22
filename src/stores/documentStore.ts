import { create } from 'zustand';
import { Document, DocumentMetadata, SyncStatus } from '../types';
import * as documentService from '../services/documentService';
import { createProductionSafety } from '../core/productionSafety';
import { DocumentContract, DocumentMetadataContract } from '../core/dataContracts';
import { getObservability, traced } from '../core/observability';

// Initialize safety layer
const safety = createProductionSafety({
  environment: process.env.NODE_ENV || 'development',
  enableStrictValidation: true,
  blockPlaceholders: true,
  requireDataContracts: true,
  enableObservability: true,
});

// Register data contracts
safety.registerContract('document', DocumentContract);
safety.registerContract('documentMetadata', DocumentMetadataContract);

// Initialize observability
const obs = getObservability();

interface DocumentState {
  documents: DocumentMetadata[];
  currentDocument: Document | null;
  isLoading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  searchQuery: string;
  filteredDocuments: DocumentMetadata[];
  validationErrors: string[];
  safetyEnabled: boolean;

  // Actions
  loadDocuments: () => Promise<void>;
  loadDocument: (id: string) => Promise<void>;
  createDocument: (title: string, type: string) => Promise<Document>;
  saveDocument: (document: Document) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  syncDocuments: () => Promise<void>;
  setCurrentDocument: (document: Document | null) => void;
  validateDocument: (document: Document) => boolean;
  enableSafety: () => void;
  disableSafety: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  currentDocument: null,
  isLoading: false,
  error: null,
  syncStatus: { connected: false, lastSync: null, pendingChanges: 0 },
  searchQuery: '',
  filteredDocuments: [],
  validationErrors: [],
  safetyEnabled: true,

  loadDocuments: traced('documentStore.loadDocuments', async () => {
    set({ isLoading: true, error: null, validationErrors: [] });
    const span = obs.startSpan('documentStore.loadDocuments');

    try {
      const docs = await documentService.getAllDocuments();

      // Validate all documents if safety is enabled
      if (get().safetyEnabled) {
        const validationErrors: string[] = [];
        const validDocs: DocumentMetadata[] = [];

        for (const doc of docs) {
          const result = safety.validate('documentMetadata', doc);
          if (!result.isValid) {
            validationErrors.push(
              `Document "${doc.title}": ${result.errors.map(e => e.message).join(', ')}`
            );
            obs.warn('Document validation failed', { docId: doc.id, errors: result.errors });
          } else {
            validDocs.push(doc);
          }
        }

        // Check for placeholder data
        const placeholderErrors = safety.detectPlaceholders(docs);
        if (placeholderErrors.length > 0) {
          placeholderErrors.forEach(err => {
            validationErrors.push(`Placeholder detected: ${err.message}`);
            obs.error('Placeholder data detected', undefined, { location: err.location });
          });
        }

        set({ validationErrors, documents: validDocs, filteredDocuments: validDocs, isLoading: false });
        obs.recordMetric('document.validation_errors', validationErrors.length);
        obs.recordMetric('document.count', validDocs.length);
      } else {
        set({ documents: docs, filteredDocuments: docs, isLoading: false });
      }

      obs.endSpan(span);
    } catch (error) {
      obs.endSpan(span, error as Error);
      obs.error('Failed to load documents', error as Error);
      set({ error: error instanceof Error ? error.message : 'Failed to load documents', isLoading: false });
    }
  }),

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

  saveDocument: traced('documentStore.saveDocument', async (document: Document) => {
    const state = get();
    set({ isLoading: true, error: null, validationErrors: [] });
    const span = obs.startSpan('documentStore.saveDocument');

    try {
      // Safety check before saving
      if (state.safetyEnabled) {
        const safetyCheck = safety.performSafetyCheck('saveDocument', document);

        if (!safetyCheck.isSafe) {
          const errorMessages = safetyCheck.checks
            .filter(c => !c.passed)
            .map(c => c.message)
            .join('; ');

          obs.error('Document save blocked by safety check', undefined, {
            reasons: safetyCheck.blockedActions,
            recommendations: safetyCheck.recommendations,
          });

          set({
            error: `Save blocked: ${errorMessages}`,
            validationErrors: safetyCheck.recommendations,
            isLoading: false,
          });
          obs.endSpan(span);
          throw new Error(`Save blocked by safety check: ${errorMessages}`);
        }

        // Validate against schema
        const validation = safety.validate('document', document);
        if (!validation.isValid) {
          const errorMessages = validation.errors.map(e => e.message).join('; ');
          obs.error('Document schema validation failed', undefined, { errors: validation.errors });

          set({
            error: `Validation failed: ${errorMessages}`,
            validationErrors: validation.errors.map(e => `${e.code}: ${e.message}`),
            isLoading: false,
          });
          obs.endSpan(span);
          throw new Error(`Schema validation failed: ${errorMessages}`);
        }

        obs.recordMetric('document.validation_passed', 1);
      }

      const updated = await documentService.saveDocument(document);

      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === updated.metadata.id ? updated.metadata : d
        ),
        currentDocument: updated,
        isLoading: false
      }));

      obs.recordMetric('document.saved', 1);
      obs.endSpan(span);
    } catch (error) {
      obs.endSpan(span, error as Error);
      obs.error('Failed to save document', error as Error);
      set({ error: error instanceof Error ? error.message : 'Failed to save document', isLoading: false });
      throw error;
    }
  }),

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
  },

  validateDocument: (document: Document) => {
    const result = safety.validate('document', document);
    if (!result.isValid) {
      set({ validationErrors: result.errors.map(e => `${e.code}: ${e.message}`) });
      obs.warn('Document validation failed', { errors: result.errors });
    }
    return result.isValid;
  },

  enableSafety: () => {
    set({ safetyEnabled: true });
    obs.info('Document safety checks enabled');
  },

  disableSafety: () => {
    set({ safetyEnabled: false });
    obs.warn('Document safety checks disabled - placeholder data may be allowed');
  },
}));
