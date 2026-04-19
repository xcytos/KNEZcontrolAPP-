/**
 * Memory Vector Search Service
 * 
 * Implements semantic search for memories using vector embeddings
 * 
 * Applied Learnings:
 * - Learning 40-46: Vector Database Purpose, Recall vs Speed, Hybrid Search
 * - Learning 75-77: B-Tree Indexing for vector similarity
 * - Learning 83-85: Cache-Aside and Write-Through Caching Strategies
 */

import { getMemoryEventSourcingService, MemoryState } from './MemoryEventSourcingService';

export interface MemoryVector {
  id: string;
  embedding: number[];
  domain: string;
  tags: string[];
  timestamp: string;
  contentHash: string;
}

export interface MemorySearchResult {
  memory: MemoryState;
  similarity: number;
  matchReason: string;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  domain?: string;
  tags?: string[];
  recall?: number;
}

/**
 * Simple in-memory vector search service
 * Can be upgraded to pgvector or other vector databases later
 */
export class MemoryVectorSearchService {
  private vectors: Map<string, MemoryVector> = new Map();
  private memoryService = getMemoryEventSourcingService();
  private cache: Map<string, MemorySearchResult[]> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate a simple embedding from text
   * In production, use OpenAI embeddings or similar
   */
  private generateEmbedding(text: string): number[] {
    // Simple TF-IDF-like embedding for demonstration
    // In production, replace with actual embedding service
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(1536).fill(0); // Match OpenAI embedding size
    
    words.forEach((word, i) => {
      const hash = this.simpleHash(word);
      const index = Math.abs(hash) % embedding.length;
      embedding[index] += 1;
    });

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Index a memory for vector search
   */
  async indexMemory(memory: MemoryState): Promise<void> {
    const text = `${memory.title} ${memory.content}`;
    const embedding = this.generateEmbedding(text);
    const contentHash = this.simpleHash(text).toString();

    const vector: MemoryVector = {
      id: memory.id,
      embedding,
      domain: memory.domain,
      tags: memory.tags,
      timestamp: memory.updatedAt,
      contentHash
    };

    this.vectors.set(memory.id, vector);
  }

  /**
   * Index all memories from event sourcing
   */
  async indexAllMemories(): Promise<void> {
    const memories = this.memoryService.getAllMemories();
    
    for (const memory of memories) {
      await this.indexMemory(memory);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  /**
   * Search memories by semantic similarity
   * Implements hybrid search (Learning 44)
   */
  async searchMemories(
    query: string,
    options: SearchOptions = {}
  ): Promise<MemorySearchResult[]> {
    const {
      limit = 10,
      threshold = 0.3,
      domain,
      tags,
      recall = 0.95
    } = options;

    // Check cache first (Cache-Aside pattern, Learning 83)
    const cacheKey = `${query}:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - (cached as any).timestamp < this.cacheTTL) {
      return cached;
    }

    // Generate query embedding
    const queryEmbedding = this.generateEmbedding(query);

    // Calculate similarities
    const results: MemorySearchResult[] = [];

    for (const [memoryId, vector] of this.vectors.entries()) {
      // Domain filter (pre-filtering, Learning 44)
      if (domain && vector.domain !== domain) continue;

      // Tag filter
      if (tags && tags.length > 0) {
        const hasTag = tags.some(tag => vector.tags.includes(tag));
        if (!hasTag) continue;
      }

      // Calculate similarity
      const similarity = this.cosineSimilarity(queryEmbedding, vector.embedding);

      if (similarity >= threshold) {
        const memory = this.memoryService.getMemoryState(memoryId);
        if (memory) {
          results.push({
            memory,
            similarity,
            matchReason: similarity > 0.8 ? 'Strong semantic match' : 'Partial semantic match'
          });
        }
      }
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity);
    const limited = results.slice(0, limit);

    // Cache results (Learning 83)
    (limited as any).timestamp = Date.now();
    this.cache.set(cacheKey, limited);

    return limited;
  }

  /**
   * Hybrid search: combine semantic and keyword search
   */
  async hybridSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<MemorySearchResult[]> {
    // Semantic search
    const semanticResults = await this.searchMemories(query, options);

    // Keyword search (fallback)
    const keywordResults = this.memoryService.searchMemories(query);

    // Merge and deduplicate
    const merged = new Map<string, MemorySearchResult>();

    // Add semantic results with higher weight
    semanticResults.forEach(result => {
      merged.set(result.memory.id, {
        ...result,
        similarity: result.similarity * 1.5 // Boost semantic matches
      });
    });

    // Add keyword results
    keywordResults.forEach(memory => {
      if (!merged.has(memory.id)) {
        merged.set(memory.id, {
          memory,
          similarity: 0.5, // Base similarity for keyword match
          matchReason: 'Keyword match'
        });
      }
    });

    // Convert to array and sort
    const results = Array.from(merged.values());
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, options.limit || 10);
  }

  /**
   * Find similar memories to a given memory
   */
  async findSimilarMemories(
    memoryId: string,
    options: SearchOptions = {}
  ): Promise<MemorySearchResult[]> {
    const memory = this.memoryService.getMemoryState(memoryId);
    if (!memory) return [];

    const query = `${memory.title} ${memory.content}`;
    return this.searchMemories(query, {
      ...options,
      threshold: options.threshold || 0.5
    });
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get search statistics
   */
  getStats(): {
    indexedCount: number;
    cacheSize: number;
    avgEmbeddingDimension: number;
  } {
    let totalDimension = 0;
    for (const vector of this.vectors.values()) {
      totalDimension += vector.embedding.length;
    }

    return {
      indexedCount: this.vectors.size,
      cacheSize: this.cache.size,
      avgEmbeddingDimension: this.vectors.size > 0 ? totalDimension / this.vectors.size : 0
    };
  }
}

// Singleton instance
let memoryVectorSearchService: MemoryVectorSearchService | null = null;

export function getMemoryVectorSearchService(): MemoryVectorSearchService {
  if (!memoryVectorSearchService) {
    memoryVectorSearchService = new MemoryVectorSearchService();
    // Initialize with existing memories
    memoryVectorSearchService.indexAllMemories();
  }
  return memoryVectorSearchService;
}

export function resetMemoryVectorSearchService(): void {
  memoryVectorSearchService = null;
}
