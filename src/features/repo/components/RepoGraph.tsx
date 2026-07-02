import { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { FileNodeData } from '../../../services/repo/types';
import { FileNode } from './FileNode';

const nodeTypes = {
  fileNode: FileNode,
};

interface RepoGraphProps {
  files: FileNodeData[];
  sessionFileMap: Record<string, { sessionIds: string[]; accessCount: number; lastAccessed: string }>;
  currentSessionId?: string;
  onFileSelect: (node: FileNodeData) => void;
}

export const RepoGraph = ({ files, sessionFileMap, currentSessionId, onFileSelect }: RepoGraphProps) => {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const spacing = 220;
    const sessionGroupFiles = new Map<string, FileNodeData[]>();

    for (const file of files) {
      const info = sessionFileMap[file.path];
      if (!info || info.sessionIds.length === 0) continue;

      for (const sid of info.sessionIds) {
        if (!sessionGroupFiles.has(sid)) {
          sessionGroupFiles.set(sid, []);
        }
        sessionGroupFiles.get(sid)!.push(file);
      }
    }

    if (sessionGroupFiles.size === 0) {
      files.slice(0, 50).forEach((file, i) => {
        const col = i % 10;
        const row = Math.floor(i / 10);
        const info = sessionFileMap[file.path];
        const isCurrent = currentSessionId && info?.sessionIds.includes(currentSessionId);

        nodes.push({
          id: `file-${file.path}`,
          type: 'fileNode',
          position: { x: col * spacing, y: row * spacing },
          data: {
            name: file.name,
            path: file.path,
            sessionColor: isCurrent ? 'emerald' : info ? 'blue' : 'zinc',
            sessionIds: info?.sessionIds || [],
            accessCount: info?.accessCount || 0,
            onFileSelect: () => onFileSelect(file),
          },
        });
      });
      return { nodes, edges };
    }

    let yOffset = 0;
    for (const [sid, sessionFiles] of sessionGroupFiles) {
      const isCurrent = sid === currentSessionId;
      const label = isCurrent ? `Current Session` : `Session ${sid.slice(0, 8)}`;

      const labelNodeId = `label-${sid}`;
      nodes.push({
        id: labelNodeId,
        type: 'default',
        position: { x: 0, y: yOffset },
        data: { label },
        style: {
          background: isCurrent ? '#059669' : '#2563eb',
          color: '#fff',
          fontSize: '10px',
          padding: '4px 8px',
          borderRadius: '4px',
          border: 'none',
          width: 140,
        },
      });

      sessionFiles.slice(0, 30).forEach((file, i) => {
        const nodeId = `file-${file.path}`;
        nodes.push({
          id: nodeId,
          type: 'fileNode',
          position: { x: 160 + (i % 6) * spacing, y: yOffset + Math.floor(i / 6) * 80 },
          data: {
            name: file.name,
            path: file.path,
            sessionColor: isCurrent ? 'emerald' : 'blue',
            sessionIds: [sid],
            accessCount: sessionFileMap[file.path]?.accessCount || 0,
          },
        });

        edges.push({
          id: `edge-${sid}-${file.path}`,
          source: labelNodeId,
          target: nodeId,
          type: 'smoothstep',
          animated: isCurrent,
          style: {
            stroke: isCurrent ? '#059669' : '#2563eb',
            strokeWidth: isCurrent ? 2 : 1,
            opacity: isCurrent ? 0.8 : 0.4,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isCurrent ? '#059669' : '#2563eb',
          },
        });
      });

      yOffset += Math.max(120, Math.ceil(sessionFiles.length / 6) * 80 + 40);
    }

    return { nodes, edges };
  }, [files, sessionFileMap, currentSessionId, onFileSelect]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600">
        <div className="text-center">
          <p className="text-sm">No session-file relationships found</p>
          <p className="text-xs mt-1">Open a session and modify files to see connections</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="#27272a" gap={20} />
        <Controls className="!bg-zinc-900 !border-zinc-800 !rounded-lg" />
        <MiniMap
          nodeStrokeColor="#52525b"
          nodeColor="#18181b"
          nodeBorderRadius={4}
          style={{ background: '#09090b', border: '1px solid #27272a' }}
        />
      </ReactFlow>
    </div>
  );
};
