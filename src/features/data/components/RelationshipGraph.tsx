import React, { useMemo, useCallback, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { X } from 'lucide-react';
import { Project, SessionListItem } from '../../../services/data/TaqwinDataService';
import { Document } from './DocumentList';
import { ProjectNode } from './nodes/ProjectNode';
import { SessionNode } from './nodes/SessionNode';
import { DocumentNode } from './nodes/DocumentNode';

interface RelationshipGraphProps {
  projects: Project[];
  allSessions: SessionListItem[];
  allDocuments: Document[];
  onClose: () => void;
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToSession?: (sessionId: string, projectId: string) => void;
  onNavigateToDocument?: (documentId: string) => void;
}

interface GraphStats {
  totalProjects: number;
  totalSessions: number;
  totalDocuments: number;
  orphanedSessions: number;
  orphanedDocuments: number;
}

// Define nodeTypes outside component to prevent recreation on each render
// Define nodeTypes outside component to prevent recreation on each render
const nodeTypes = {
  project: ProjectNode,
  session: SessionNode,
  document: DocumentNode,
};

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  projects,
  allSessions,
  allDocuments,
  onClose,
  onNavigateToProject,
  onNavigateToSession,
  onNavigateToDocument,
}) => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showProjects, setShowProjects] = useState(true);
  const [showSessions, setShowSessions] = useState(true);
  const [showDocuments, setShowDocuments] = useState(false); // Hide documents by default for cleaner view

  // Transform data into graph nodes and edges
  const { nodes: initialNodes, edges: initialEdges, stats } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Calculate stats
    const orphanedSessions = allSessions.filter(s => !s.project_id || s.project_id === '').length;
    const orphanedDocuments = allDocuments.filter(d => !d.session_id || d.session_id === '').length;
    
    // Build project hierarchy tree
    const buildTree = (projects: Project[]) => {
      const projectMap = new Map<string, Project>();
      projects.forEach(p => projectMap.set(p.project_id, p));
      
      const roots: Project[] = [];
      projects.forEach(p => {
        if (!p.parent_project_id || !projectMap.has(p.parent_project_id)) {
          roots.push(p);
        }
      });
      
      return roots;
    };
    
    const rootProjects = buildTree(projects);
    
    const stats: GraphStats = {
      totalProjects: projects.length,
      totalSessions: allSessions.length,
      totalDocuments: allDocuments.length,
      orphanedSessions,
      orphanedDocuments,
    };

    // Layout configuration
    const nodeWidth = 280; // Approximate width of a node
    const siblingSpacing = 350; // Horizontal space between siblings at same level
    const verticalSpacing = 250; // Vertical space between parent-child levels
    const sessionVerticalSpacing = 180; // Space between sessions
    const sessionHorizontalOffset = 60; // Offset sessions to the right
    const startY = 80; // Top margin
    
    // Calculate the total width a project subtree will occupy
    const calculateSubtreeWidth = (project: Project): number => {
      const projectSessions = allSessions.filter(s => s.project_id === project.project_id);
      
      // If no children, width is based on this node + its sessions
      if (!project.children || project.children.length === 0) {
        // Width is node itself, or sessions if they extend further right
        const sessionWidth = projectSessions.length > 0 ? sessionHorizontalOffset + nodeWidth : nodeWidth;
        return sessionWidth;
      }
      
      // If has children, width is sum of all children widths + spacing between them
      const childrenWidth = project.children.reduce((total, child, index) => {
        const childWidth = calculateSubtreeWidth(child);
        return total + childWidth + (index > 0 ? siblingSpacing : 0);
      }, 0);
      
      // Return the maximum of: node width, children total width, or sessions width
      const sessionWidth = projectSessions.length > 0 ? sessionHorizontalOffset + nodeWidth : nodeWidth;
      return Math.max(nodeWidth, childrenWidth, sessionWidth);
    };
    
    // Recursive layout function with proper horizontal distribution
    const layoutNode = (
      project: Project,
      x: number,
      y: number,
      level: number
    ): number => {
      const projectSessions = allSessions.filter(s => s.project_id === project.project_id);
      const projectDocCount = projectSessions.reduce((sum, session) => {
        const sessionDocs = allDocuments.filter(d => d.session_id === (session.session_id || session.id));
        return sum + sessionDocs.length;
      }, 0);

      // Calculate this subtree's total width for centering
      const subtreeWidth = calculateSubtreeWidth(project);
      
      // Center the project node over its subtree
      const nodeX = x + (subtreeWidth / 2) - (nodeWidth / 2);
      
      // Add project node
      nodes.push({
        id: `project-${project.project_id}`,
        type: 'project',
        position: { x: nodeX, y },
        data: {
          project,
          sessionCount: projectSessions.length,
          documentCount: projectDocCount,
          onNavigate: () => onNavigateToProject?.(project.project_id),
        },
      });

      let maxSubtreeHeight = y + verticalSpacing;
      
      // Layout child projects horizontally distributed below parent
      if (project.children && project.children.length > 0) {
        let currentChildX = x; // Start from left edge of subtree
        
        project.children.forEach((child) => {
          // Add parent-child edge
          edges.push({
            id: `edge-parent-${project.project_id}-child-${child.project_id}`,
            source: `project-${project.project_id}`,
            target: `project-${child.project_id}`,
            type: 'step', // Orthogonal edges (90° angles)
            animated: false,
            style: { stroke: '#9333ea', strokeWidth: 3, strokeDasharray: '8,4' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#9333ea',
              width: 25,
              height: 25,
            },
          });
          
          const childY = y + verticalSpacing;
          
          // Recursively layout child and get its bottom-most Y position
          const childBottomY = layoutNode(child, currentChildX, childY, level + 1);
          maxSubtreeHeight = Math.max(maxSubtreeHeight, childBottomY);
          
          // Move X position for next sibling
          const childWidth = calculateSubtreeWidth(child);
          currentChildX += childWidth + siblingSpacing;
        });
      }
      
      // Layout sessions vertically below project (or below all children if they exist)
      if (projectSessions.length > 0) {
        const sessionX = nodeX + sessionHorizontalOffset;
        let currentSessionY = maxSubtreeHeight;
        
        projectSessions.forEach((session, index) => {
          const sessionId = session.session_id || session.id;
          const sessionDocs = allDocuments.filter(d => d.session_id === sessionId);
          const sessionY = currentSessionY + (index * sessionVerticalSpacing);

          nodes.push({
            id: `session-${sessionId}`,
            type: 'session',
            position: { x: sessionX, y: sessionY },
            data: {
              session,
              documentCount: sessionDocs.length,
              onNavigate: () => onNavigateToSession?.(sessionId, project.project_id),
            },
          });

          // Add edge from project to session
          edges.push({
            id: `edge-project-${project.project_id}-session-${sessionId}`,
            source: `project-${project.project_id}`,
            target: `session-${sessionId}`,
            type: 'step', // Orthogonal edges
            animated: false,
            style: { stroke: '#2563eb', strokeWidth: 2.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#2563eb',
              width: 20,
              height: 20,
            },
          });
        });
        
        // Update max height if sessions extend lower
        if (projectSessions.length > 0) {
          maxSubtreeHeight = currentSessionY + (projectSessions.length * sessionVerticalSpacing);
        }
      }
      
      // Return the bottom-most Y coordinate of this subtree
      return maxSubtreeHeight;
    };

    // Layout root projects horizontally in a row at the top
    let currentX = 100;
    rootProjects.forEach((rootProject) => {
      layoutNode(rootProject, currentX, startY, 0);
      const projectWidth = calculateSubtreeWidth(rootProject);
      currentX += projectWidth + siblingSpacing; // Move right for next root project
    });

    return { nodes, edges, stats };
  }, [projects, allSessions, allDocuments, onNavigateToProject, onNavigateToSession, onNavigateToDocument]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Filter nodes based on toggle state
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      if (node.type === 'project' && !showProjects) return false;
      if (node.type === 'session' && !showSessions) return false;
      if (node.type === 'document' && !showDocuments) return false;
      return true;
    });
  }, [nodes, showProjects, showSessions, showDocuments]);

  const filteredEdges = useMemo(() => {
    // Only show edges where both source and target nodes are visible
    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
    return edges.filter(edge => 
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [edges, filteredNodes]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.data.onNavigate) {
      node.data.onNavigate();
      onClose();
    }
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            📊 Relationship Graph
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {stats.totalProjects} Projects • {stats.totalSessions} Sessions • {stats.totalDocuments} Documents
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-zinc-800 rounded transition-colors"
          title="Close"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-zinc-300">Filter:</div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showProjects}
              onChange={(e) => setShowProjects(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-zinc-300">Projects</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSessions}
              onChange={(e) => setShowSessions(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-zinc-300">Sessions</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDocuments}
              onChange={(e) => setShowDocuments(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-pink-600 focus:ring-pink-500"
            />
            <span className="text-sm text-zinc-300">Documents</span>
          </label>
        </div>

        {stats.orphanedSessions > 0 || stats.orphanedDocuments > 0 ? (
          <div className="flex items-center gap-4 text-sm">
            {stats.orphanedSessions > 0 && (
              <div className="px-3 py-1 bg-amber-900/30 border border-amber-800 rounded text-amber-300">
                ⚠️ {stats.orphanedSessions} orphaned sessions
              </div>
            )}
            {stats.orphanedDocuments > 0 && (
              <div className="px-3 py-1 bg-amber-900/30 border border-amber-800 rounded text-amber-300">
                ⚠️ {stats.orphanedDocuments} orphaned documents
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          attributionPosition="bottom-left"
          className="bg-zinc-950"
        >
          <Background color="#27272a" gap={16} />
          <Controls className="bg-zinc-900 border-zinc-800" />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'project') return '#581c87';
              if (node.type === 'session') return '#1e3a8a';
              if (node.type === 'document') return '#831843';
              return '#27272a';
            }}
            maskColor="rgba(0, 0, 0, 0.6)"
            className="bg-zinc-900 border border-zinc-800"
          />
        </ReactFlow>

        {/* Selected Node Detail Panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-80 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs text-zinc-500 uppercase">{selectedNode.type}</div>
                <div className="text-sm font-semibold text-zinc-100 mt-1">
                  {selectedNode.type === 'project' && selectedNode.data.project.project_name}
                  {selectedNode.type === 'session' && selectedNode.data.session.name}
                  {selectedNode.type === 'document' && selectedNode.data.document.title}
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-zinc-800 rounded transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              {selectedNode.type === 'project' && (
                <>
                  <div className="flex justify-between text-zinc-400">
                    <span>Sessions:</span>
                    <span className="text-zinc-200">{selectedNode.data.sessionCount}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Documents:</span>
                    <span className="text-zinc-200">{selectedNode.data.documentCount}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-2 font-mono truncate">
                    {selectedNode.data.project.project_path}
                  </div>
                </>
              )}

              {selectedNode.type === 'session' && (
                <>
                  <div className="flex justify-between text-zinc-400">
                    <span>Display ID:</span>
                    <span className="text-zinc-200 font-mono">{selectedNode.data.session.display_id}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Documents:</span>
                    <span className="text-zinc-200">{selectedNode.data.documentCount}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-2">
                    {new Date(selectedNode.data.session.created_at).toLocaleDateString()}
                  </div>
                </>
              )}

              {selectedNode.type === 'document' && (
                <>
                  <div className="flex justify-between text-zinc-400">
                    <span>Type:</span>
                    <span className="text-zinc-200">{selectedNode.data.document.doc_type}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-2">
                    Created: {new Date(selectedNode.data.document.created_at).toLocaleDateString()}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => {
                if (selectedNode.data.onNavigate) {
                  selectedNode.data.onNavigate();
                  onClose();
                }
              }}
              className="w-full mt-4 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors"
            >
              View Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
