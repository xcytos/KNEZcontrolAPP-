import React, { useState } from 'react';
import { Block } from '../../../domain/DataContracts';

interface MCPBlockProps {
  block: Extract<Block, { type: 'mcp_call' }>;
}

export const MCPBlock: React.FC<MCPBlockProps> = ({ block }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = () => {
    switch (block.status) {
      case 'pending': return 'text-yellow-600';
      case 'running': return 'text-blue-600';
      case 'success': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (block.status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'success': return '✅';
      case 'failed': return '❌';
      default: return '⚡';
    }
  };

  const parseBrowserNavigateResult = (result: any) => {
    if (!result?.content || !Array.isArray(result.content) || !result.content[0]?.text) {
      return null;
    }

    const text = result.content[0].text;
    const sections = new Map<string, string>();
    const sectionHeaders = text.split(/^### /m).slice(1);
    
    for (const section of sectionHeaders) {
      const firstNewlineIndex = section.indexOf('\n');
      if (firstNewlineIndex === -1) continue;
      const sectionName = section.substring(0, firstNewlineIndex);
      const sectionContent = section.substring(firstNewlineIndex + 1).trim();
      sections.set(sectionName, sectionContent);
    }

    const snapshot = sections.get('Snapshot') || sections.get('snapshot');
    const code = sections.get('Ran Playwright code');
    const error = sections.get('Error');
    const resultSection = sections.get('Result');

    let page_url: string | undefined;
    if (code) {
      const urlMatch = code.match(/page\.goto\(['"`](.*?)['"`]\)/);
      if (urlMatch) page_url = urlMatch[1];
    }

    let title: string | undefined;
    if (snapshot) {
      const titleMatch = snapshot.match(/title\s+(.*?)(?:\n|\[)/i);
      if (titleMatch) title = titleMatch[1].trim();
    }

    return {
      page_url,
      title,
      snapshot: snapshot ? 'Snapshot available' : null,
      logs: error || resultSection
    };
  };

  const parsedResult = block.result ? parseBrowserNavigateResult(block.result) : null;

  return (
    <div className="my-2 border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={getStatusColor()}>{getStatusIcon()}</span>
        <span className="font-medium text-sm text-gray-700">
          MCP Tool: {block.tool}
        </span>
        {block.executionTimeMs && (
          <span className="text-xs text-gray-500 ml-auto">
            {block.executionTimeMs}ms
          </span>
        )}
        <span className="text-gray-400 text-xs">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {isExpanded && (
        <div className="p-3 bg-white border-t border-gray-200">
          {/* Arguments */}
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Arguments:</div>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
              {JSON.stringify(block.args, null, 2)}
            </pre>
          </div>

          {/* Parsed Output (structured, not raw) */}
          {parsedResult && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-500 mb-1">Result:</div>
              {parsedResult.page_url && (
                <div className="text-xs mb-1">
                  <span className="font-medium">Page URL:</span> {parsedResult.page_url}
                </div>
              )}
              {parsedResult.title && (
                <div className="text-xs mb-1">
                  <span className="font-medium">Title:</span> {parsedResult.title}
                </div>
              )}
              {parsedResult.snapshot && (
                <div className="text-xs mb-1">
                  <span className="font-medium">Snapshot:</span> {parsedResult.snapshot}
                </div>
              )}
              {parsedResult.logs && (
                <div className="text-xs">
                  <span className="font-medium">Logs:</span> {parsedResult.logs}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {block.error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              <span className="font-semibold">Error:</span> {block.error}
            </div>
          )}

          {/* Raw result fallback if parsing fails */}
          {!parsedResult && block.result && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-500 mb-1">Raw Output:</div>
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(block.result, null, 2)}
              </pre>
            </div>
          )}

          {/* MCP Latency */}
          {block.mcpLatencyMs && (
            <div className="text-xs text-gray-500">
              MCP Latency: {block.mcpLatencyMs}ms
            </div>
          )}
        </div>
      )}
    </div>
  );
};
