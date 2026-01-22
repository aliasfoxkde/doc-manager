/**
 * Vector Store for Document Embeddings
 * Stores embeddings in IndexedDB with similarity search
 * Enables semantic search across all documents
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface VectorDBSchema extends DBSchema {
  embeddings: {
    key: string;
    value: {
      id: string;
      documentId: string;
      text: string;
      embedding: Float32Array;
      metadata: {
        chunkIndex: number;
        totalChunks: number;
        timestamp: number;
        documentTitle: string;
        documentType: string;
      };
    };
    indexes: {
      documentId: string;
      timestamp: number;
    };
  };
}

interface SearchResult {
  documentId: string;
  chunkId: string;
  text: string;
  score: number;
  metadata: {
    documentTitle: string;
    documentType: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

class VectorStore {
  private static instance: VectorStore;
  private db: IDBPDatabase<VectorDBSchema> | null = null;
  private readonly DB_NAME = 'DocManagerVectors';
  private readonly DB_VERSION = 1;
  private readonly MAX_TEXT_LENGTH = 500; // Chars per embedding chunk
  private readonly OVERLAP = 50; // Overlap between chunks

  private constructor() {}

  static getInstance(): VectorStore {
    if (!VectorStore.instance) {
      VectorStore.instance = new VectorStore();
    }
    return VectorStore.instance;
  }

  /**
   * Initialize the vector database
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    try {
      this.db = await openDB<VectorDBSchema>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          const store = db.createObjectStore('embeddings', { keyPath: 'id' });
          store.createIndex('documentId', 'metadata.documentId');
          store.createIndex('timestamp', 'metadata.timestamp');
        }
      });
      console.log('[VectorStore] Database initialized');
    } catch (error) {
      console.error('[VectorStore] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Chunk text into smaller pieces for embedding
   */
  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    let index = 0;

    while (index < text.length) {
      const end = Math.min(index + this.MAX_TEXT_LENGTH, text.length);
      const chunk = text.slice(index, end);
      chunks.push(chunk.trim());
      index = end - this.OVERLAP;
    }

    return chunks.filter(c => c.length > 0);
  }

  /**
   * Add document embeddings to the store
   */
  async addDocument(
    documentId: string,
    title: string,
    content: string,
    type: string,
    embeddings: Float32Array[]
  ): Promise<void> {
    await this.initialize();

    if (!this.db) throw new Error('Database not initialized');

    const chunks = this.chunkText(content);
    const timestamp = Date.now();

    try {
      const tx = this.db.transaction('embeddings', 'readwrite');
      const store = tx.objectStore('embeddings');

      // Clear existing embeddings for this document
      await store.index('documentId').openCursor(IDBKeyRange.only(documentId))
        .then(cursor => {
          return new Promise<void>((resolve) => {
            const deleteNext = (): void => {
              if (cursor) {
                cursor.delete();
                cursor.continue().then(deleteNext);
              } else {
                resolve();
              }
            };
            deleteNext();
          });
        });

      // Add new embeddings
      for (let i = 0; i < Math.min(chunks.length, embeddings.length); i++) {
        await store.put({
          id: `${documentId}-chunk-${i}`,
          documentId: documentId,
          text: chunks[i],
          embedding: embeddings[i],
          metadata: {
            chunkIndex: i,
            totalChunks: chunks.length,
            timestamp: timestamp,
            documentTitle: title,
            documentType: type
          }
        });
      }

      await tx.done;
      console.log(`[VectorStore] Added ${chunks.length} chunks for document: ${title}`);
    } catch (error) {
      console.error('[VectorStore] Failed to add document:', error);
      throw error;
    }
  }

  /**
   * Delete document embeddings from the store
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.initialize();

    if (!this.db) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction('embeddings', 'readwrite');
      const store = tx.objectStore('embeddings');
      const index = store.index('documentId');

      let count = 0;
      for await (const cursor of index.iterate(IDBKeyRange.only(documentId))) {
        await cursor.delete();
        count++;
      }

      await tx.done;
      console.log(`[VectorStore] Deleted ${count} chunks for document: ${documentId}`);
    } catch (error) {
      console.error('[VectorStore] Failed to delete document:', error);
      throw error;
    }
  }

  /**
   * Semantic search using cosine similarity
   */
  async search(
    queryEmbedding: Float32Array,
    limit: number = 10,
    minScore: number = 0.5
  ): Promise<SearchResult[]> {
    await this.initialize();

    if (!this.db) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction('embeddings', 'readonly');
      const store = tx.objectStore('embeddings');

      const results: Array<{ id: string; embedding: Float32Array; text: string; metadata: any }> = [];

      // Collect all embeddings
      for await (const cursor of store) {
        results.push({
          id: cursor.value.id,
          embedding: cursor.value.embedding,
          text: cursor.value.text,
          metadata: cursor.value.metadata
        });
      }

      await tx.done;

      // Calculate similarities
      const scored = results.map(r => ({
        chunkId: r.id,
        documentId: r.metadata.documentId || r.id.split('-chunk-')[0],
        text: r.text,
        score: this.cosineSimilarity(queryEmbedding, r.embedding),
        metadata: {
          documentTitle: r.metadata.documentTitle,
          documentType: r.metadata.documentType,
          chunkIndex: r.metadata.chunkIndex,
          totalChunks: r.metadata.totalChunks
        }
      }));

      // Filter by minimum score and sort
      return scored
        .filter(r => r.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('[VectorStore] Search failed:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Get statistics about the vector store
   */
  async getStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    lastUpdated: number;
  }> {
    await this.initialize();

    if (!this.db) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction('embeddings', 'readonly');
      const store = tx.objectStore('embeddings');

      const chunks = await store.getAll();
      const documents = new Set(chunks.map(c => c.metadata.documentId || c.id.split('-chunk-')[0]));
      const lastUpdated = Math.max(...chunks.map(c => c.metadata.timestamp), 0);

      await tx.done;

      return {
        totalDocuments: documents.size,
        totalChunks: chunks.length,
        lastUpdated
      };
    } catch (error) {
      console.error('[VectorStore] Failed to get stats:', error);
      throw error;
    }
  }

  /**
   * Clear all embeddings
   */
  async clear(): Promise<void> {
    await this.initialize();

    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.clear('embeddings');
      console.log('[VectorStore] Cleared all embeddings');
    } catch (error) {
      console.error('[VectorStore] Failed to clear:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const vectorStore = VectorStore.getInstance();
