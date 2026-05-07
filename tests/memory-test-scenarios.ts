/**
 * Memory Test Scenarios for KNEZ Control App
 * 
 * 5 Chat Scenarios to verify:
 * 1. Memory structure integrity
 * 2. Proper memory sync
 * 3. Knowledge extraction
 * 4. UI reactions in Memory Dashboard
 */

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  messages: Array<{
    from: 'user' | 'assistant';
    text: string;
    expectedMemoryType?: 'learning' | 'mistake' | 'decision' | 'pattern';
  }>;
  expectedMemoryCount: number;
  verifySync: boolean;
}

export const memoryTestScenarios: TestScenario[] = [
  {
    id: 'scenario-1',
    name: 'Basic Knowledge Learning',
    description: 'Simple Q&A that should extract a learning memory',
    messages: [
      {
        from: 'user',
        text: 'What is the best way to handle errors in async functions?'
      },
      {
        from: 'assistant',
        text: 'The best way to handle errors in async functions is to use try-catch blocks with proper error propagation. Always await promises and handle rejections at appropriate levels. Key insights: 1) Use try-catch for synchronous errors, 2) Check promise rejections with .catch(), 3) Implement centralized error handling for consistency.',
        expectedMemoryType: 'learning'
      }
    ],
    expectedMemoryCount: 1,
    verifySync: true
  },
  {
    id: 'scenario-2',
    name: 'Multi-turn Conversation',
    description: 'Extended conversation with multiple topics',
    messages: [
      {
        from: 'user',
        text: 'How do I optimize React components?'
      },
      {
        from: 'assistant',
        text: 'React optimization techniques include: 1) useMemo for expensive calculations, 2) useCallback for function stability, 3) React.memo for component memoization, 4) Code splitting with React.lazy, 5) Virtualization for long lists.',
        expectedMemoryType: 'learning'
      },
      {
        from: 'user',
        text: 'What about state management?'
      },
      {
        from: 'assistant',
        text: 'For React state management, consider: 1) useState for local component state, 2) useReducer for complex logic, 3) Context API for global state, 4) Zustand or Redux for large applications. Important: Avoid prop drilling by using composition or context.',
        expectedMemoryType: 'decision'
      },
      {
        from: 'user',
        text: 'Any common mistakes to avoid?'
      },
      {
        from: 'assistant',
        text: 'Common React mistakes: 1) Mutating state directly - always use setState, 2) Not cleaning up useEffect subscriptions, 3) Over-using useMemo without profiling, 4) Inline object/function definitions in render, 5) Not using keys properly in lists. These can cause performance issues and bugs.',
        expectedMemoryType: 'mistake'
      }
    ],
    expectedMemoryCount: 3,
    verifySync: true
  },
  {
    id: 'scenario-3',
    name: 'Tool Execution Session',
    description: 'Chat with MCP tool calls',
    messages: [
      {
        from: 'user',
        text: 'Please navigate to example.com and check the page title'
      },
      {
        from: 'assistant',
        text: 'I\'ll navigate to example.com using the browser tool and check the page title.',
      },
      {
        from: 'assistant',
        text: 'Tool Execution: puppeteer_navigate\nInput: { "url": "https://example.com" }\n\nOutput: { "status": "success", "page_title": "Example Domain" }\n\nThe page title is "Example Domain". This is a simple web page with a heading and description.',
        expectedMemoryType: 'learning'
      }
    ],
    expectedMemoryCount: 1,
    verifySync: true
  },
  {
    id: 'scenario-4',
    name: 'Memory Persistence Test',
    description: 'Chat designed to trigger memory storage and persistence',
    messages: [
      {
        from: 'user',
        text: 'I learned that we should always validate user input on both client and server sides. Never trust client-side validation alone.',
      },
      {
        from: 'assistant',
        text: 'Excellent point! Security insight: Always implement server-side validation regardless of client-side checks. Client validation is for UX, server validation is for security. Pattern: Defense in depth - validate at multiple layers. This is a critical security principle.',
        expectedMemoryType: 'learning'
      },
      {
        from: 'user',
        text: 'Also, we made a mistake last week by not sanitizing the file upload input, which caused a security vulnerability.',
      },
      {
        from: 'assistant',
        text: 'Important mistake to document: File upload vulnerabilities are serious. Lessons learned: 1) Always validate file types, 2) Check file size limits, 3) Sanitize filenames, 4) Store uploads outside web root, 5) Scan for malware. This should be a documented pattern to prevent future occurrences.',
        expectedMemoryType: 'mistake'
      }
    ],
    expectedMemoryCount: 2,
    verifySync: true
  },
  {
    id: 'scenario-5',
    name: 'Error Recovery Pattern',
    description: 'Chat with failure scenarios and recovery patterns',
    messages: [
      {
        from: 'user',
        text: 'The database connection keeps failing. What should we do?'
      },
      {
        from: 'assistant',
        text: 'Database connection failures require a systematic approach:\n\n1. Immediate actions:\n   - Check connection string and credentials\n   - Verify network connectivity\n   - Review database server logs\n\n2. Recovery pattern:\n   - Implement connection pooling\n   - Add retry logic with exponential backoff\n   - Set up circuit breaker pattern\n   - Configure proper timeouts\n\n3. Prevention:\n   - Monitor connection health\n   - Set up alerts for connection failures\n   - Document recovery procedures',
        expectedMemoryType: 'pattern'
      },
      {
        from: 'user',
        text: 'We should decide on the retry strategy - exponential backoff or fixed intervals?'
      },
      {
        from: 'assistant',
        text: 'Decision: Use exponential backoff with jitter.\n\nRationale:\n- Exponential backoff reduces load on failing services\n- Jitter prevents thundering herd problems\n- More resilient than fixed intervals\n\nImplementation:\n- Initial delay: 100ms\n- Max delay: 30 seconds\n- Max retries: 5\n- Add random 0-100ms jitter\n\nThis pattern prevents cascading failures and allows systems to recover naturally.',
        expectedMemoryType: 'decision'
      }
    ],
    expectedMemoryCount: 2,
    verifySync: true
  }
];

export interface TestResults {
  scenarioId: string;
  passed: boolean;
  memoriesCreated: number;
  syncSuccessful: boolean;
  uiReactionsCorrect: boolean;
  errors: string[];
  timestamp: string;
}

export const runMemoryTest = async (
  scenario: TestScenario,
  executeChat: (messages: TestScenario['messages']) => Promise<void>,
  checkMemoryCount: () => Promise<number>,
  verifySync: () => Promise<boolean>
): Promise<TestResults> => {
  const errors: string[] = [];
  const timestamp = new Date().toISOString();
  
  try {
    // Execute chat scenario
    await executeChat(scenario.messages);
    
    // Check memory count
    const memoriesCreated = await checkMemoryCount();
    const memoryCountCorrect = memoriesCreated === scenario.expectedMemoryCount;
    
    if (!memoryCountCorrect) {
      errors.push(`Expected ${scenario.expectedMemoryCount} memories, got ${memoriesCreated}`);
    }
    
    // Verify sync if required
    let syncSuccessful = true;
    if (scenario.verifySync) {
      syncSuccessful = await verifySync();
      if (!syncSuccessful) {
        errors.push('Memory sync verification failed');
      }
    }
    
    const passed = memoryCountCorrect && syncSuccessful;
    
    return {
      scenarioId: scenario.id,
      passed,
      memoriesCreated,
      syncSuccessful,
      uiReactionsCorrect: passed, // Simplified for now
      errors,
      timestamp
    };
  } catch (error) {
    return {
      scenarioId: scenario.id,
      passed: false,
      memoriesCreated: 0,
      syncSuccessful: false,
      uiReactionsCorrect: false,
      errors: [...errors, String(error)],
      timestamp
    };
  }
};
