/**
 * Semantic Search Component
 * Provides AI-powered semantic search across documents using embeddings
 */

import { useState, useEffect, useRef } from 'react';
import { embeddingService } from '../services/embeddingService';
import { vectorStore } from '../services/vectorStore';

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

interface SemanticSearchProps {
  onResultClick?: (documentId: string) => void;
  placeholder?: string;
  minScore?: number;
  maxResults?: number;
}

export function SemanticSearch({
  onResultClick,
  placeholder = 'Search documents by meaning...',
  minScore = 0.5,
  maxResults = 10
}: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize embedding service
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await embeddingService.initialize();
        await vectorStore.initialize();

        if (mounted) {
          setIsReady(true);
          console.log('[SemanticSearch] Initialized');
        }
      } catch (error) {
        console.error('[SemanticSearch] Failed to initialize:', error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search
  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);

    if (!searchQuery.trim() || !isReady) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    setShowResults(true);

    try {
      // Generate embedding for query
      const queryEmbedding = await embeddingService.embed(searchQuery);

      // Search vector store
      const searchResults = await vectorStore.search(
        queryEmbedding,
        maxResults,
        minScore
      );

      setResults(searchResults);
    } catch (error) {
      console.error('[SemanticSearch] Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        handleSearch(query);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    if (onResultClick) {
      onResultClick(result.documentId);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  };

  return (
    <div className="semantic-search-container" ref={searchRef}>
      <input
        ref={inputRef}
        type="text"
        className="semantic-search-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (results.length > 0) setShowResults(true);
        }}
        disabled={!isReady}
      />
      {!isReady && (
        <div className="search-status">Initializing search...</div>
      )}

      {showResults && results.length > 0 && (
        <div className="semantic-search-results">
          {results.map((result, index) => (
            <div
              key={`${result.chunkId}-${index}`}
              className="semantic-search-result-item"
              onClick={() => handleResultClick(result)}
            >
              <div className="semantic-result-title">
                {result.metadata.documentTitle}
              </div>
              <div className="semantic-result-score">
                Relevance: {(result.score * 100).toFixed(0)}%
              </div>
              <div className="semantic-result-excerpt">
                {result.text}
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && isLoading && (
        <div className="semantic-search-results">
          <div className="search-loading">
            <div className="search-loading-spinner" />
            Searching...
          </div>
        </div>
      )}

      {showResults && !isLoading && query && results.length === 0 && (
        <div className="semantic-search-results">
          <div className="search-empty">No matching documents found</div>
        </div>
      )}
    </div>
  );
}

export default SemanticSearch;
