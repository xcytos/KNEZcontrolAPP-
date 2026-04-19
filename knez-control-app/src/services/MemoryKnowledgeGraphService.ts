/**
 * Memory Knowledge Graph Service
 * 
 * Implements knowledge graph for memory relationships
 * 
 * Applied Learnings:
 * - Learning 47-48: Graph Database Fundamentals, RDF vs Property Graph
 * - Learning 51-53: Knowledge Graph Definition, Benefits, Use Cases
 * - Learning 99-102: Taxonomy vs Ontology, Schema Design for AI
 * - Learning 122-124: Columnar vs Row Storage for graph queries
 */

import Database from 'better-sqlite3';
import { getMemoryEventSourcingService, MemoryState } from './MemoryEventSourcingService';

export interface GraphNode {
  id: string;
  type: 'learning' | 'mistake' | 'decision' | 'pattern';
  properties: {
    title: string;
    domain: string;
    timestamp: string;
    tags: string[];
    [key: string]: unknown;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: 'relates_to' | 'caused' | 'resolved' | 'similar_to' | 'depends_on';
  weight: number;
  timestamp: string;
}

export interface GraphContext {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
}

export interface GraphCluster {
  id: string;
  nodes: string[];
  label: string;
  centrality: number;
}

export class MemoryKnowledgeGraphService {
  private db: Database.Database;
  private memoryService = getMemoryEventSourcingService();

  constructor(dbPath: string = '.taqwin/memory/graph.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create nodes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        properties TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create edges table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        relationship TEXT NOT NULL,
        weight REAL NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (source) REFERENCES nodes(id),
        FOREIGN KEY (target) REFERENCES nodes(id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_edges_relationship ON edges(relationship)
    `);

    // Create ontology table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ontology (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        parent_id TEXT,
        properties TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES ontology(id)
      )
    `);
  }

  /**
   * Build graph from event-sourced memories
   */
  async buildGraph(): Promise<void> {
    const memories = this.memoryService.getAllMemories();

    this.db.exec('BEGIN TRANSACTION');

    try {
      // Clear existing graph
      this.db.exec('DELETE FROM edges');
      this.db.exec('DELETE FROM nodes');

      // Create nodes from memories
      for (const memory of memories) {
        const node: GraphNode = {
          id: memory.id,
          type: memory.type,
          properties: {
            title: memory.title,
            domain: memory.domain,
            timestamp: memory.createdAt,
            tags: memory.tags
          }
        };

        const stmt = this.db.prepare(`
          INSERT INTO nodes (id, type, properties, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(
          node.id,
          node.type,
          JSON.stringify(node.properties),
          memory.createdAt,
          memory.updatedAt
        );
      }

      // Create edges from memory relations
      for (const memory of memories) {
        for (const relation of memory.relations) {
          const edge: GraphEdge = {
            id: `${memory.id}-${relation.relatedMemoryId}`,
            source: memory.id,
            target: relation.relatedMemoryId,
            relationship: relation.relationship,
            weight: relation.weight,
            timestamp: relation.addedAt
          };

          const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO edges (id, source, target, relationship, weight, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            edge.id,
            edge.source,
            edge.target,
            edge.relationship,
            edge.weight,
            edge.timestamp
          );
        }
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Find related memories (graph traversal)
   */
  findRelatedMemories(memoryId: string, depth: number = 2): GraphNode[] {
    const visited = new Set<string>();
    const queue: string[] = [memoryId];
    const relatedIds: string[] = [];

    while (queue.length > 0 && depth > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const stmt = this.db.prepare(`
        SELECT target FROM edges WHERE source = ?
      `);
      const edges = stmt.all(currentId) as any[];

      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          relatedIds.push(edge.target);
          queue.push(edge.target);
        }
      }

      depth--;
    }

    // Get node details
    const nodes: GraphNode[] = [];
    for (const id of relatedIds) {
      const node = this.getNode(id);
      if (node) nodes.push(node);
    }

    return nodes;
  }

  /**
   * Find shortest path between two memories
   */
  findShortestPath(fromId: string, toId: string): GraphNode[] {
    const visited = new Set<string>();
    const parentMap = new Map<string, string>();
    const queue: string[] = [fromId];
    visited.add(fromId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (currentId === toId) {
        // Reconstruct path
        const path: GraphNode[] = [];
        let current = toId;
        while (current !== fromId) {
          const node = this.getNode(current);
          if (node) path.unshift(node);
          current = parentMap.get(current)!;
        }
        const fromNode = this.getNode(fromId);
        if (fromNode) path.unshift(fromNode);
        return path;
      }

      const stmt = this.db.prepare(`
        SELECT target FROM edges WHERE source = ?
      `);
      const edges = stmt.all(currentId) as any[];

      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          parentMap.set(edge.target, currentId);
          queue.push(edge.target);
        }
      }
    }

    return []; // No path found
  }

  /**
   * Find clusters in the graph (connected components)
   */
  findClusters(): GraphCluster[] {
    const allNodes = this.getAllNodes();
    const visited = new Set<string>();
    const clusters: GraphCluster[] = [];
    let clusterId = 0;

    for (const node of allNodes) {
      if (visited.has(node.id)) continue;

      // BFS to find connected component
      const component: string[] = [];
      const queue: string[] = [node.id];
      visited.add(node.id);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        component.push(currentId);

        const stmt = this.db.prepare(`
          SELECT target FROM edges WHERE source = ?
        `);
        const edges = stmt.all(currentId) as any[];

        for (const edge of edges) {
          if (!visited.has(edge.target)) {
            visited.add(edge.target);
            queue.push(edge.target);
          }
        }
      }

      // Calculate centrality (number of connections)
      let centrality = 0;
      for (const nodeId of component) {
        const stmt = this.db.prepare(`
          SELECT COUNT(*) as count FROM edges WHERE source = ? OR target = ?
        `);
        const result = stmt.get(nodeId, nodeId) as any;
        centrality += result.count;
      }
      centrality /= component.length;

      clusters.push({
        id: `cluster-${clusterId++}`,
        nodes: component,
        label: this.generateClusterLabel(component),
        centrality
      });
    }

    return clusters.sort((a, b) => b.centrality - a.centrality);
  }

  /**
   * Get memory context (neighbors and clusters)
   */
  getMemoryContext(memoryId: string): GraphContext {
    const nodes = this.findRelatedMemories(memoryId, 2);
    const node = this.getNode(memoryId);
    if (node) nodes.unshift(node);

    const edges = this.getEdgesForNode(memoryId);
    const clusters = this.findClusters();

    return { nodes, edges, clusters };
  }

  /**
   * Get node by ID
   */
  private getNode(id: string): GraphNode | null {
    const stmt = this.db.prepare(`
      SELECT id, type, properties FROM nodes WHERE id = ?
    `);
    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      type: row.type,
      properties: JSON.parse(row.properties)
    };
  }

  /**
   * Get all nodes
   */
  private getAllNodes(): GraphNode[] {
    const stmt = this.db.prepare('SELECT id, type, properties FROM nodes');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      properties: JSON.parse(row.properties)
    }));
  }

  /**
   * Get edges for a node
   */
  private getEdgesForNode(nodeId: string): GraphEdge[] {
    const stmt = this.db.prepare(`
      SELECT id, source, target, relationship, weight, timestamp
      FROM edges WHERE source = ? OR target = ?
    `);
    const rows = stmt.all(nodeId, nodeId) as any[];
    return rows.map(row => ({
      id: row.id,
      source: row.source,
      target: row.target,
      relationship: row.relationship,
      weight: row.weight,
      timestamp: row.timestamp
    }));
  }

  /**
   * Generate cluster label based on common properties
   */
  private generateClusterLabel(nodeIds: string[]): string {
    const domains: Map<string, number> = new Map();
    const types: Map<string, number> = new Map();

    for (const id of nodeIds) {
      const node = this.getNode(id);
      if (node) {
        const domain = node.properties.domain as string;
        const type = node.type;
        domains.set(domain, (domains.get(domain) || 0) + 1);
        types.set(type, (types.get(type) || 0) + 1);
      }
    }

    const topDomain = [...domains.entries()].sort((a, b) => b[1] - a[1])[0];
    const topType = [...types.entries()].sort((a, b) => b[1] - a[1])[0];

    return `${topDomain?.[0] || 'unknown'} ${topType?.[0] || 'cluster'}`;
  }

  /**
   * Add ontology entry
   */
  addOntologyEntry(
    id: string,
    type: string,
    parentId: string | null,
    properties: Record<string, unknown>
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ontology (id, type, parent_id, properties)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, type, parentId, JSON.stringify(properties));
  }

  /**
   * Get ontology tree
   */
  getOntologyTree(): any[] {
    const stmt = this.db.prepare('SELECT id, type, parent_id, properties FROM ontology');
    const rows = stmt.all() as any[];

    const nodes = new Map<string, any>();
    const roots: any[] = [];

    for (const row of rows) {
      nodes.set(row.id, {
        id: row.id,
        type: row.type,
        parentId: row.parent_id,
        properties: JSON.parse(row.properties),
        children: []
      });
    }

    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    clusterCount: number;
    avgDegree: number;
  } {
    const nodeCount = this.db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
    const edgeCount = this.db.prepare('SELECT COUNT(*) as count FROM edges').get() as { count: number };
    const clusters = this.findClusters();

    // Calculate average degree
    const degreeStmt = this.db.prepare(`
      SELECT AVG(degree) as avg_degree FROM (
        SELECT (out_degree + in_degree) as degree FROM (
          SELECT 
            (SELECT COUNT(*) FROM edges WHERE source = n.id) as out_degree,
            (SELECT COUNT(*) FROM edges WHERE target = n.id) as in_degree
          FROM nodes n
        )
      )
    `);
    const avgDegree = degreeStmt.get() as { avg_degree: number } | null;

    return {
      nodeCount: nodeCount.count,
      edgeCount: edgeCount.count,
      clusterCount: clusters.length,
      avgDegree: avgDegree?.avg_degree || 0
    };
  }
}

// Singleton instance
let memoryKnowledgeGraphService: MemoryKnowledgeGraphService | null = null;

export function getMemoryKnowledgeGraphService(): MemoryKnowledgeGraphService {
  if (!memoryKnowledgeGraphService) {
    memoryKnowledgeGraphService = new MemoryKnowledgeGraphService();
    // Build initial graph
    memoryKnowledgeGraphService.buildGraph();
  }
  return memoryKnowledgeGraphService;
}

export function resetMemoryKnowledgeGraphService(): void {
  if (memoryKnowledgeGraphService) {
    memoryKnowledgeGraphService.close();
    memoryKnowledgeGraphService = null;
  }
}
