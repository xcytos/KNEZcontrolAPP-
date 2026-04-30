/**
 * TAQWIN Tool Registry Bridge
 * Bridges TAQWIN MCP tools to unified system
 */

import { getUnifiedMemoryAPI } from '../../memory/shared/UnifiedMemoryAPI';
import { UnifiedMemory } from '../../memory/shared/UnifiedMemoryDatabase';

export interface TaqwinTool {
  name: string;
  description: string;
  category: string;
  handler: string;
  enabled: boolean;
  usage_count: number;
  last_used?: string;
  parameters: TaqwinToolParameter[];
}

export interface TaqwinToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: any;
}

export interface ToolExecution {
  id: string;
  tool_name: string;
  parameters: Record<string, any>;
  result: any;
  error?: string;
  execution_time: number;
  timestamp: string;
  session_id: string;
  success: boolean;
}

export class ToolRegistryBridge {
  private api = getUnifiedMemoryAPI();
  private registeredTools: Map<string, TaqwinTool> = new Map();
  private executionHistory: ToolExecution[] = [];

  constructor() {
    this._initializeToolRegistry();
  }

  /**
   * Initialize tool registry with known TAQWIN tools
   */
  private _initializeToolRegistry(): void {
    const tools: TaqwinTool[] = [
      {
        name: 'activate_taqwin_unified_consciousness',
        description: 'Activate TAQWIN unified consciousness system',
        category: 'consciousness',
        handler: 'ConsciousnessHandler',
        enabled: true,
        usage_count: 0,
        parameters: [
          {
            name: 'mode',
            type: 'string',
            required: false,
            description: 'Activation mode (standard, enhanced, deep)',
            default: 'standard'
          },
          {
            name: 'persistence',
            type: 'boolean',
            required: false,
            description: 'Enable persistent consciousness',
            default: false
          }
        ]
      },
      {
        name: 'get_server_status',
        description: 'Get comprehensive server status and metrics',
        category: 'system',
        handler: 'StatusHandler',
        enabled: true,
        usage_count: 0,
        parameters: [
          {
            name: 'detailed',
            type: 'boolean',
            required: false,
            description: 'Include detailed system metrics',
            default: false
          }
        ]
      },
      {
        name: 'deploy_real_taqwin_council',
        description: 'Deploy real TAQWIN council agents',
        category: 'council',
        handler: 'RealAgentCouncilHandler',
        enabled: true,
        usage_count: 0,
        parameters: [
          {
            name: 'action',
            type: 'string',
            required: true,
            description: 'Action to perform (deploy, status, dismiss)'
          },
          {
            name: 'agents',
            type: 'array',
            required: false,
            description: 'List of agents to deploy',
            default: ['all']
          },
          {
            name: 'session_name',
            type: 'string',
            required: false,
            description: 'Council session name',
            default: 'default_council'
          }
        ]
      },
      {
        name: 'session',
        description: 'Manage TAQWIN sessions',
        category: 'session',
        handler: 'SessionsHandler',
        enabled: true,
        usage_count: 0,
        parameters: [
          {
            name: 'action',
            type: 'string',
            required: true,
            description: 'Session action (create, list, get, delete)'
          },
          {
            name: 'session_id',
            type: 'string',
            required: false,
            description: 'Session ID for specific operations'
          }
        ]
      },
      {
        name: 'scan_database',
        description: 'Scan and analyze database contents',
        category: 'database',
        handler: 'DatabaseScanHandler',
        enabled: true,
        usage_count: 0,
        parameters: [
          {
            name: 'table',
            type: 'string',
            required: false,
            description: 'Specific table to scan',
            default: 'all'
          },
          {
            name: 'analysis_level',
            type: 'string',
            required: false,
            description: 'Analysis depth (basic, detailed, comprehensive)',
            default: 'basic'
          }
        ]
      },
      {
        name: 'web_intelligence',
        description: 'Perform web intelligence operations',
        category: 'web',
        handler: 'WebIntelligenceHandler',
        enabled: true,
        usage_count: 0,
        parameters: [
          {
            name: 'action',
            type: 'string',
            required: true,
            description: 'Web action (search, analyze, extract)'
          },
          {
            name: 'target',
            type: 'string',
            required: true,
            description: 'Target URL or search query'
          },
          {
            name: 'depth',
            type: 'number',
            required: false,
            description: 'Analysis depth level',
            default: 1
          }
        ]
      },
      {
        name: 'debug_test',
        description: 'Debug and test operations',
        category: 'debug',
        handler: 'TestHandler',
        enabled: true,
        usage_count: 0,
        parameters: [
          {
            name: 'test_type',
            type: 'string',
            required: true,
            description: 'Type of test to perform'
          },
          {
            name: 'parameters',
            type: 'object',
            required: false,
            description: 'Test-specific parameters',
            default: {}
          }
        ]
      }
    ];

    tools.forEach(tool => {
      this.registeredTools.set(tool.name, tool);
    });
  }

  /**
   * Get all registered tools
   */
  getRegisteredTools(): TaqwinTool[] {
    return Array.from(this.registeredTools.values());
  }

  /**
   * Get tool by name
   */
  getTool(name: string): TaqwinTool | undefined {
    return this.registeredTools.get(name);
  }

  /**
   * Register a new tool
   */
  registerTool(tool: TaqwinTool): void {
    this.registeredTools.set(tool.name, tool);
    this._logToolRegistration(tool);
  }

  /**
   * Enable/disable a tool
   */
  setToolEnabled(name: string, enabled: boolean): boolean {
    const tool = this.registeredTools.get(name);
    if (tool) {
      tool.enabled = enabled;
      this._logToolStatusChange(tool, enabled);
      return true;
    }
    return false;
  }

  /**
   * Record tool execution
   */
  recordExecution(execution: ToolExecution): void {
    // Add to execution history
    this.executionHistory.push(execution);
    
    // Keep only last 1000 executions
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-1000);
    }

    // Update tool usage statistics
    const tool = this.registeredTools.get(execution.tool_name);
    if (tool) {
      tool.usage_count++;
      tool.last_used = execution.timestamp;
    }

    // Store execution in unified memory
    this._storeExecutionInMemory(execution);
  }

  /**
   * Get tool execution history
   */
  getExecutionHistory(toolName?: string, limit: number = 100): ToolExecution[] {
    let history = this.executionHistory;
    
    if (toolName) {
      history = history.filter(exec => exec.tool_name === toolName);
    }
    
    return history.slice(-limit).reverse();
  }

  /**
   * Get tool usage statistics
   */
  getUsageStatistics(): {
    total_executions: number;
    success_rate: number;
    average_execution_time: number;
    tool_usage: Record<string, number>;
    category_usage: Record<string, number>;
  } {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(exec => exec.success).length;
    const totalTime = this.executionHistory.reduce((sum, exec) => sum + exec.execution_time, 0);
    
    const toolUsage: Record<string, number> = {};
    const categoryUsage: Record<string, number> = {};
    
    this.executionHistory.forEach(exec => {
      toolUsage[exec.tool_name] = (toolUsage[exec.tool_name] || 0) + 1;
      
      const tool = this.registeredTools.get(exec.tool_name);
      if (tool) {
        categoryUsage[tool.category] = (categoryUsage[tool.category] || 0) + 1;
      }
    });

    return {
      total_executions: total,
      success_rate: total > 0 ? successful / total : 0,
      average_execution_time: total > 0 ? totalTime / total : 0,
      tool_usage: toolUsage,
      category_usage: categoryUsage
    };
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): TaqwinTool[] {
    return Array.from(this.registeredTools.values())
      .filter(tool => tool.category === category);
  }

  /**
   * Search tools
   */
  searchTools(query: string): TaqwinTool[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.registeredTools.values())
      .filter(tool => 
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.category.toLowerCase().includes(lowerQuery)
      );
  }

  /**
   * Validate tool parameters
   */
  validateParameters(toolName: string, parameters: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    const tool = this.registeredTools.get(toolName);
    if (!tool) {
      return {
        valid: false,
        errors: [`Tool '${toolName}' not found`]
      };
    }

    const errors: string[] = [];
    
    // Check required parameters
    tool.parameters.forEach(param => {
      if (param.required && !(param.name in parameters)) {
        errors.push(`Required parameter '${param.name}' is missing`);
      }
    });

    // Type validation (basic)
    tool.parameters.forEach(param => {
      if (param.name in parameters) {
        const value = parameters[param.name];
        const expectedType = param.type;
        
        if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`Parameter '${param.name}' should be a string`);
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`Parameter '${param.name}' should be a number`);
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Parameter '${param.name}' should be a boolean`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Export tool registry
   */
  exportRegistry(): {
    tools: TaqwinTool[];
    statistics: ReturnType<typeof this.getUsageStatistics>;
    exported_at: string;
  } {
    return {
      tools: this.getRegisteredTools(),
      statistics: this.getUsageStatistics(),
      exported_at: new Date().toISOString()
    };
  }

  /**
   * Import tool registry
   */
  importRegistry(data: {
    tools: TaqwinTool[];
    statistics?: any;
  }): void {
    data.tools.forEach(tool => {
      this.registerTool(tool);
    });
  }

  private async _logToolRegistration(tool: TaqwinTool): Promise<void> {
    try {
      const content = `Tool Registered: ${tool.name}\n\nDescription: ${tool.description}\nCategory: ${tool.category}\nHandler: ${tool.handler}`;
      
      await this.api.createMemory({
        session_id: 'taqwin_tool_registry',
        title: `Tool Registered: ${tool.name}`,
        content: content,
        type: 'event',
        domain: 'tools',
        tags: ['taqwin', 'tool', 'registry', tool.category],
        importance: 5,
        confidence: 1.0,
        metadata: {
          tool_name: tool.name,
          tool_category: tool.category,
          tool_handler: tool.handler,
          registered_at: new Date().toISOString()
        },
        system_origin: 'taqwin'
      });
    } catch (error) {
      console.error('Failed to log tool registration:', error);
    }
  }

  private async _logToolStatusChange(tool: TaqwinTool, enabled: boolean): Promise<void> {
    try {
      const content = `Tool ${enabled ? 'Enabled' : 'Disabled'}: ${tool.name}\n\nStatus: ${enabled ? 'Active' : 'Inactive'}`;
      
      await this.api.createMemory({
        session_id: 'taqwin_tool_registry',
        title: `Tool ${enabled ? 'Enabled' : 'Disabled'}: ${tool.name}`,
        content: content,
        type: 'event',
        domain: 'tools',
        tags: ['taqwin', 'tool', 'status', tool.category],
        importance: 4,
        confidence: 1.0,
        metadata: {
          tool_name: tool.name,
          tool_category: tool.category,
          status: enabled ? 'enabled' : 'disabled',
          changed_at: new Date().toISOString()
        },
        system_origin: 'taqwin'
      });
    } catch (error) {
      console.error('Failed to log tool status change:', error);
    }
  }

  private async _storeExecutionInMemory(execution: ToolExecution): Promise<void> {
    try {
      let content = `Tool Execution: ${execution.tool_name}\n\nParameters: ${JSON.stringify(execution.parameters, null, 2)}\n\nResult: ${execution.success ? 'Success' : 'Failed'}\nExecution Time: ${execution.execution_time}ms`;
      
      if (execution.error) {
        content += `\n\nError: ${execution.error}`;
      }
      
      await this.api.createMemory({
        session_id: execution.session_id,
        title: `Tool Execution: ${execution.tool_name}`,
        content: content,
        type: execution.success ? 'event' : 'mistake',
        domain: 'tools',
        tags: ['taqwin', 'tool', 'execution', execution.tool_name],
        importance: execution.success ? 4 : 6,
        confidence: 1.0,
        metadata: {
          tool_name: execution.tool_name,
          execution_id: execution.id,
          success: execution.success,
          execution_time: execution.execution_time,
          parameters: execution.parameters,
          timestamp: execution.timestamp
        },
        system_origin: 'taqwin'
      });
    } catch (error) {
      console.error('Failed to store execution in memory:', error);
    }
  }
}

export default ToolRegistryBridge;
