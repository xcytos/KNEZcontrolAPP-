/**
 * ToolRouter - Routes tasks to appropriate tool categories
 * Prevents wrong tool selection and provides alternatives
 */

export enum ToolCategory {
  BROWSER = "browser",
  WEB_INTELLIGENCE = "web_intelligence",
  INTERNAL = "internal",
  FILE = "file",
  SEARCH = "search"
}

export interface ToolCapability {
  canNavigate: boolean;
  canInteract: boolean;
  canExtract: boolean;
  canSearch: boolean;
  canModifyFiles: boolean;
}

export interface ToolRoute {
  category: ToolCategory;
  priority: number;
  requiredCapabilities: ToolCapability;
  toolName: string;
}

export interface RoutingResult {
  valid: boolean;
  suggestedRoutes: ToolRoute[];
  alternatives: string[];
  reason?: string;
}

export class ToolRouter {
  private toolRegistry: Map<string, ToolRoute> = new Map();

  constructor() {
    this.initializeToolRegistry();
  }

  /**
   * Initialize tool registry with known tools and their categories
   */
  private initializeToolRegistry(): void {
    // Browser tools (playwright)
    this.registerTool({
      category: ToolCategory.BROWSER,
      priority: 1,
      requiredCapabilities: {
        canNavigate: true,
        canInteract: false,
        canExtract: false,
        canSearch: false,
        canModifyFiles: false
      },
      toolName: "playwright_browser_navigate"
    });

    this.registerTool({
      category: ToolCategory.BROWSER,
      priority: 2,
      requiredCapabilities: {
        canNavigate: false,
        canInteract: true,
        canExtract: false,
        canSearch: false,
        canModifyFiles: false
      },
      toolName: "playwright_browser_click"
    });

    this.registerTool({
      category: ToolCategory.BROWSER,
      priority: 2,
      requiredCapabilities: {
        canNavigate: false,
        canInteract: true,
        canExtract: false,
        canSearch: false,
        canModifyFiles: false
      },
      toolName: "playwright_browser_type"
    });

    this.registerTool({
      category: ToolCategory.BROWSER,
      priority: 3,
      requiredCapabilities: {
        canNavigate: false,
        canInteract: false,
        canExtract: true,
        canSearch: false,
        canModifyFiles: false
      },
      toolName: "playwright_browser_snapshot"
    });

    // Web intelligence tools
    this.registerTool({
      category: ToolCategory.WEB_INTELLIGENCE,
      priority: 1,
      requiredCapabilities: {
        canNavigate: false,
        canInteract: false,
        canExtract: false,
        canSearch: true,
        canModifyFiles: false
      },
      toolName: "web_intelligence_search"
    });

    // File tools
    this.registerTool({
      category: ToolCategory.FILE,
      priority: 1,
      requiredCapabilities: {
        canNavigate: false,
        canInteract: false,
        canExtract: true,
        canSearch: false,
        canModifyFiles: true
      },
      toolName: "file_write"
    });

    this.registerTool({
      category: ToolCategory.FILE,
      priority: 1,
      requiredCapabilities: {
        canNavigate: false,
        canInteract: false,
        canExtract: true,
        canSearch: false,
        canModifyFiles: false
      },
      toolName: "file_read"
    });
  }

  /**
   * Register a tool in the registry
   */
  private registerTool(route: ToolRoute): void {
    this.toolRegistry.set(route.toolName, route);
  }

  /**
   * Route task description to appropriate tools
   */
  route(taskDescription: string): ToolRoute[] {
    const lowerTask = taskDescription.toLowerCase();
    const requiredCapabilities = this.analyzeTaskCapabilities(lowerTask);
    
    // Find tools matching required capabilities
    const matchingTools = Array.from(this.toolRegistry.values())
      .filter(tool => this.capabilitiesMatch(tool.requiredCapabilities, requiredCapabilities))
      .sort((a, b) => a.priority - b.priority);

    return matchingTools;
  }

  /**
   * Validate tool selection for a task
   */
  validateToolSelection(taskDescription: string, selectedTool: string): boolean {
    const routes = this.route(taskDescription);
    const validToolNames = routes.map(r => r.toolName);
    
    return validToolNames.includes(selectedTool);
  }

  /**
   * Suggest alternative tools for a task
   */
  suggestAlternatives(taskDescription: string): string[] {
    const routes = this.route(taskDescription);
    return routes.map(r => r.toolName);
  }

  /**
   * Get comprehensive routing result
   */
  getRoutingResult(taskDescription: string, selectedTool?: string): RoutingResult {
    const routes = this.route(taskDescription);
    
    if (routes.length === 0) {
      return {
        valid: false,
        suggestedRoutes: [],
        alternatives: [],
        reason: "No suitable tools found for this task"
      };
    }

    if (selectedTool) {
      const isValid = this.validateToolSelection(taskDescription, selectedTool);
      const alternatives = routes.map(r => r.toolName).filter(t => t !== selectedTool);
      
      return {
        valid: isValid,
        suggestedRoutes: routes,
        alternatives,
        reason: isValid ? undefined : "Selected tool is not suitable for this task"
      };
    }

    return {
      valid: true,
      suggestedRoutes: routes,
      alternatives: routes.map(r => r.toolName),
      reason: undefined
    };
  }

  /**
   * Analyze task description to determine required capabilities
   */
  private analyzeTaskCapabilities(taskDescription: string): ToolCapability {
    const capabilities: ToolCapability = {
      canNavigate: false,
      canInteract: false,
      canExtract: false,
      canSearch: false,
      canModifyFiles: false
    };

    // Navigation keywords
    const navKeywords = ["navigate", "go to", "open", "visit", "goto", "browse"];
    if (navKeywords.some(kw => taskDescription.includes(kw))) {
      capabilities.canNavigate = true;
    }

    // Interaction keywords
    const interactKeywords = ["click", "type", "input", "select", "submit", "press"];
    if (interactKeywords.some(kw => taskDescription.includes(kw))) {
      capabilities.canInteract = true;
    }

    // Extraction keywords
    const extractKeywords = ["extract", "get", "read", "snapshot", "scrape", "find"];
    if (extractKeywords.some(kw => taskDescription.includes(kw))) {
      capabilities.canExtract = true;
    }

    // Search keywords
    const searchKeywords = ["search", "query", "lookup", "find"];
    if (searchKeywords.some(kw => taskDescription.includes(kw))) {
      capabilities.canSearch = true;
    }

    // File modification keywords
    const fileKeywords = ["write", "save", "create", "edit", "modify", "delete"];
    if (fileKeywords.some(kw => taskDescription.includes(kw))) {
      capabilities.canModifyFiles = true;
    }

    return capabilities;
  }

  /**
   * Check if tool capabilities match required capabilities
   */
  private capabilitiesMatch(required: ToolCapability, available: ToolCapability): boolean {
    // Tool must have at least the required capabilities
    if (required.canNavigate && !available.canNavigate) return false;
    if (required.canInteract && !available.canInteract) return false;
    if (required.canExtract && !available.canExtract) return false;
    if (required.canSearch && !available.canSearch) return false;
    if (required.canModifyFiles && !available.canModifyFiles) return false;

    return true;
  }

  /**
   * Get tool category by name
   */
  getToolCategory(toolName: string): ToolCategory | undefined {
    const route = this.toolRegistry.get(toolName);
    return route?.category;
  }

  /**
   * Get all tools in a category
   */
  getToolsByCategory(category: ToolCategory): string[] {
    return Array.from(this.toolRegistry.values())
      .filter(route => route.category === category)
      .map(route => route.toolName);
  }

  /**
   * Check if tool is a browser tool
   */
  isBrowserTool(toolName: string): boolean {
    return this.getToolCategory(toolName) === ToolCategory.BROWSER;
  }

  /**
   * Check if tool is a web intelligence tool
   */
  isWebIntelligenceTool(toolName: string): boolean {
    return this.getToolCategory(toolName) === ToolCategory.WEB_INTELLIGENCE;
  }

  /**
   * Check if tool is an internal tool
   */
  isInternalTool(toolName: string): boolean {
    return this.getToolCategory(toolName) === ToolCategory.INTERNAL;
  }
}

// Singleton instance
export const toolRouter = new ToolRouter();
