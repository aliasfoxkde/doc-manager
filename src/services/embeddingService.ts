/**
 * Local Embedding Service using ONNX Runtime
 * Uses all-MiniLM-L6-v2 sentence transformer model
 * Runs entirely in-browser for privacy
 */

import { pipeline, env } from '@xenova/transformers';
import { getObservability } from '../core/observability';

const obs = getObservability();

// Configure transformers.js to use local models
env.allowLocalModels = true;
env.allowRemoteModels = true;

// Model configuration
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384; // all-MiniLM-L6-v2 produces 384-dimensional embeddings

class EmbeddingService {
  private static instance: EmbeddingService;
  private extractor: any = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  /**
   * Initialize the embedding model
   * Downloads the model on first use and caches it locally
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        obs.info(`[Embedding] Initializing model: ${MODEL_NAME}`);
        this.extractor = await pipeline('feature-extraction', MODEL_NAME, {
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              obs.debug(`[Embedding] Downloading: ${progress.file} (${progress.progress?.toFixed(1)}%)`);
            } else if (progress.status === 'loading') {
              obs.debug(`[Embedding] Loading: ${progress.file}`);
            }
          }
        });
        this.initialized = true;
        obs.info('[Embedding] Model initialized successfully');
      } catch (error) {
        obs.error('[Embedding] Failed to initialize', error as Error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<Float32Array> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    await this.initialize();

    try {
      // Generate embedding
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true
      });

      // Convert to Float32Array
      const embedding = new Float32Array(output.tolist());
      return embedding;
    } catch (error) {
      obs.error('[Embedding] Failed to embed text', error as Error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    await this.initialize();

    const embeddings: Float32Array[] = [];

    for (const text of texts) {
      if (text && text.trim().length > 0) {
        const embedding = await this.embed(text);
        embeddings.push(embedding);
      } else {
        // Return zero embedding for empty text
        embeddings.push(new Float32Array(EMBEDDING_DIM));
      }
    }

    return embeddings;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static similarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find top-k most similar embeddings
   */
  static findTopK(
    query: Float32Array,
    candidates: Array<{ id: string; embedding: Float32Array; metadata?: any }>,
    k: number = 5
  ): Array<{ id: string; score: number; metadata?: any }> {
    const results = candidates.map(c => ({
      id: c.id,
      score: EmbeddingService.similarity(query, c.embedding),
      metadata: c.metadata
    }));

    // Sort by score descending and take top k
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * Get embedding dimension
   */
  getDimension(): number {
    return EMBEDDING_DIM;
  }

  /**
   * Check if model is ready
   */
  isReady(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const embeddingService = EmbeddingService.getInstance();

// Export utilities
export const embeddingUtils = {
  similarity: EmbeddingService.similarity,
  findTopK: EmbeddingService.findTopK
};
