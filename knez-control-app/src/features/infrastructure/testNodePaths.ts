/**
 * Maps diagnostic tests to node paths in the KNEZ architecture
 * Each test defines a sequence of node IDs that represent the execution path
 */

export interface TestNodePath {
  testId: string;
  testName: string;
  nodePath: string[];
  layerPath: string[];
  description: string;
}

export const testNodePaths: TestNodePath[] = [
  {
    testId: '1',
    testName: 'System Response Check',
    nodePath: [
      'chat-pane',
      'chat-service',
      'knez-backend',
      'chat-service',
      'chat-pane'
    ],
    layerPath: [
      'chat-layer',
      'service-layer',
      'backend-layer',
      'service-layer',
      'chat-layer'
    ],
    description: 'Pings system and waits for KNEZ response through standard chat flow'
  },
  {
    testId: '2',
    testName: 'Web Search Extraction',
    nodePath: [
      'chat-pane',
      'chat-service',
      'knez-backend',
      'tool-executor',
      'web-search-tool',
      'mcp-host',
      'knez-backend',
      'chat-service',
      'chat-pane'
    ],
    layerPath: [
      'chat-layer',
      'service-layer',
      'backend-layer',
      'tool-execution-layer',
      'mcp-integration-layer',
      'mcp-integration-layer',
      'backend-layer',
      'service-layer',
      'chat-layer'
    ],
    description: 'Sends web search query and waits for tool execution response via MCP'
  },
  {
    testId: '3',
    testName: 'Memory Persistence',
    nodePath: [
      'chat-pane',
      'chat-service',
      'memory-store',
      'persistence-service',
      'memory-store',
      'chat-service',
      'chat-pane'
    ],
    layerPath: [
      'chat-layer',
      'service-layer',
      'memory-knowledge-layer',
      'infrastructure-system-layer',
      'memory-knowledge-layer',
      'service-layer',
      'chat-layer'
    ],
    description: 'Saves message to memory and verifies persistence across reload'
  },
  {
    testId: '4',
    testName: 'UI Navigation Smoke',
    nodePath: [
      'chat-button',
      'chat-input',
      'search-toggle'
    ],
    layerPath: [
      'chat-layer',
      'chat-layer',
      'chat-layer'
    ],
    description: 'Navigates through UI elements (Chat view, Input, Search toggle)'
  },
  {
    testId: '5',
    testName: 'Memory Gate Visibility',
    nodePath: [
      'chat-pane',
      'knez-client',
      'policy-check',
      'guardrail-enforcement',
      'event-stream',
      'knez-client',
      'chat-pane'
    ],
    layerPath: [
      'chat-layer',
      'service-layer',
      'governance-control-layer',
      'governance-control-layer',
      'observability-layer',
      'service-layer',
      'chat-layer'
    ],
    description: 'Triggers memory gate check and verifies governance events are logged'
  },
  {
    testId: '6',
    testName: 'Replay Timeline Playback',
    nodePath: [
      'chat-pane',
      'knez-client',
      'health-check',
      'knez-backend',
      'chat-service',
      'memory-store',
      'replay-timeline',
      'knez-client',
      'chat-pane'
    ],
    layerPath: [
      'chat-layer',
      'service-layer',
      'infrastructure-system-layer',
      'backend-layer',
      'service-layer',
      'memory-knowledge-layer',
      'memory-knowledge-layer',
      'service-layer',
      'chat-layer'
    ],
    description: 'Checks health, sends message, and retrieves replay timeline with events'
  },
  {
    testId: '7',
    testName: 'Send During Session Switch',
    nodePath: [
      'chat-pane',
      'chat-service',
      'session-controller',
      'knez-backend',
      'chat-service',
      'chat-pane'
    ],
    layerPath: [
      'chat-layer',
      'service-layer',
      'agent-runtime-layer',
      'backend-layer',
      'service-layer',
      'chat-layer'
    ],
    description: 'Sends message and verifies delivery during session context'
  },
  {
    testId: '8',
    testName: 'Send During Fork',
    nodePath: [
      'chat-pane',
      'chat-service',
      'session-controller',
      'fork-handler',
      'session-database',
      'knez-backend',
      'chat-service',
      'chat-pane'
    ],
    layerPath: [
      'chat-layer',
      'service-layer',
      'agent-runtime-layer',
      'agent-runtime-layer',
      'memory-knowledge-layer',
      'backend-layer',
      'service-layer',
      'chat-layer'
    ],
    description: 'Sends message, forks session, and verifies delivery after fork'
  },
  {
    testId: '9',
    testName: 'Send During Resume',
    nodePath: [
      'chat-pane',
      'chat-service',
      'session-controller',
      'resume-handler',
      'session-database',
      'knez-backend',
      'chat-service',
      'chat-pane'
    ],
    layerPath: [
      'chat-layer',
      'service-layer',
      'agent-runtime-layer',
      'agent-runtime-layer',
      'memory-knowledge-layer',
      'backend-layer',
      'service-layer',
      'chat-layer'
    ],
    description: 'Sends message, resumes session, and verifies delivery after resume'
  },
  {
    testId: '10',
    testName: 'Send During Reconnect',
    nodePath: [
      'chat-pane',
      'chat-service',
      'session-database',
      'retry-strategy',
      'knez-backend',
      'chat-service',
      'chat-pane'
    ],
    layerPath: [
      'chat-layer',
      'service-layer',
      'memory-knowledge-layer',
      'agent-runtime-layer',
      'backend-layer',
      'service-layer',
      'chat-layer'
    ],
    description: 'Sends message that fails once, triggers retry, and verifies delivery'
  },
  {
    testId: '11',
    testName: 'Stop Then Continue',
    nodePath: [
      'chat-pane',
      'chat-service',
      'knez-backend',
      'stop-handler',
      'continue-handler',
      'chat-service',
      'chat-pane'
    ],
    layerPath: [
      'chat-layer',
      'service-layer',
      'backend-layer',
      'agent-runtime-layer',
      'agent-runtime-layer',
      'service-layer',
      'chat-layer'
    ],
    description: 'Sends message, stops response, then continues from last output'
  }
];

/**
 * Get node path for a specific test
 */
export function getTestNodePath(testId: string): TestNodePath | undefined {
  return testNodePaths.find(t => t.testId === testId);
}

/**
 * Get all tests that pass through a specific node
 */
export function getTestsForNode(nodeId: string): TestNodePath[] {
  return testNodePaths.filter(t => t.nodePath.includes(nodeId));
}

/**
 * Get all tests that pass through a specific layer
 */
export function getTestsForLayer(layerId: string): TestNodePath[] {
  return testNodePaths.filter(t => t.layerPath.includes(layerId));
}
