// ─── IntentClarification.ts ─────────────────────────────────────────────────
// T16: Intent Clarification — adds intent detection, ambiguity detection, clarification questions
//     for better understanding of user requests before tool execution.
// ─────────────────────────────────────────────────────────────────────────────

export type IntentType = "navigation" | "search" | "file_operation" | "chat" | "analysis" | "ambiguous";

export interface IntentDetection {
  type: IntentType;
  confidence: number;
  detectedKeywords: string[];
  suggestedActions: string[];
}

export interface AmbiguityDetection {
  isAmbiguous: boolean;
  ambiguityType: string;
  clarificationQuestions: string[];
  suggestedClarifications: string[];
}

/**
 * Intent clarifier for detecting user intent and resolving ambiguities.
 */
export class IntentClarifier {
  private intentPatterns: Record<IntentType, string[]> = {
    navigation: ["navigate", "open", "browse", "visit", "goto", "go to", "url", "website", "page"],
    search: ["search", "find", "lookup", "query", "look for", "get information about"],
    file_operation: ["file", "read", "write", "save", "delete", "create", "edit"],
    chat: ["hi", "hello", "how are you", "what can you do", "tell me", "explain", "describe"],
    analysis: ["analyze", "compare", "summarize", "evaluate", "assess", "review"],
    ambiguous: []
  };

  /**
   * Detect user intent from text.
   */
  detectIntent(text: string): IntentDetection {
    const lowerText = text.toLowerCase();
    const detectedKeywords: string[] = [];
    const scores: Record<IntentType, number> = {
      navigation: 0,
      search: 0,
      file_operation: 0,
      chat: 0,
      analysis: 0,
      ambiguous: 0
    };

    // Score each intent type based on keyword matches
    for (const [intentType, keywords] of Object.entries(this.intentPatterns)) {
      if (intentType === "ambiguous") continue;

      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          scores[intentType as IntentType]++;
          detectedKeywords.push(keyword);
        }
      }
    }

    // Find highest scoring intent
    let maxScore = 0;
    let detectedType: IntentType = "chat";

    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedType = type as IntentType;
      }
    }

    // Calculate confidence
    const totalKeywords = detectedKeywords.length;
    const confidence = totalKeywords > 0 ? Math.min(maxScore / totalKeywords + 0.5, 1) : 0.5;

    // Generate suggested actions based on intent
    const suggestedActions = this.generateSuggestedActions(detectedType, text);

    return {
      type: detectedType,
      confidence,
      detectedKeywords,
      suggestedActions
    };
  }

  /**
   * Detect ambiguities in user request.
   */
  detectAmbiguity(text: string): AmbiguityDetection {
    const lowerText = text.toLowerCase();
    const ambiguities: string[] = [];
    const clarificationQuestions: string[] = [];

    // Check for missing URL in navigation intent
    if (lowerText.includes("navigate") || lowerText.includes("open") || lowerText.includes("visit")) {
      const urlMatch = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/);
      if (!urlMatch) {
        ambiguities.push("missing_url");
        clarificationQuestions.push("What URL would you like to navigate to?");
      }
    }

    // Check for missing search query
    if (lowerText.includes("search") || lowerText.includes("find")) {
      const words = text.split(/\s+/).filter(w => w.length > 3);
      if (words.length < 5) {
        ambiguities.push("vague_search");
        clarificationQuestions.push("What specifically would you like to search for?");
      }
    }

    // Check for missing file path
    if (lowerText.includes("file") || lowerText.includes("read") || lowerText.includes("write")) {
      const pathMatch = text.match(/[a-zA-Z]:\\[^\\]+|\/[^\s]+/);
      if (!pathMatch) {
        ambiguities.push("missing_path");
        clarificationQuestions.push("What is the file path you want to work with?");
      }
    }

    // Check for ambiguous pronouns
    if (/\b(it|they|this|that)\b/i.test(text) && !/\b(url|file|page)\b/i.test(text)) {
      ambiguities.push("ambiguous_pronoun");
      clarificationQuestions.push("Could you be more specific about what you're referring to?");
    }

    const isAmbiguous = ambiguities.length > 0;

    return {
      isAmbiguous,
      ambiguityType: ambiguities[0] || "none",
      clarificationQuestions,
      suggestedClarifications: this.generateSuggestedClarifications(text, ambiguities)
    };
  }

  /**
   * Generate suggested actions based on detected intent.
   */
  private generateSuggestedActions(intentType: IntentType, _text: string): string[] {
    const actions: string[] = [];

    switch (intentType) {
      case "navigation":
        actions.push("Use browser_navigate tool to visit the URL");
        actions.push("Wait for page to load");
        actions.push("Extract content from the page");
        break;

      case "search":
        actions.push("Use browser_navigate to search engine");
        actions.push("Enter search query");
        actions.push("Extract search results");
        break;

      case "file_operation":
        actions.push("Use filesystem tools to perform the operation");
        actions.push("Verify file exists before reading/writing");
        actions.push("Handle file permissions");
        break;

      case "chat":
        actions.push("Respond directly with natural language");
        actions.push("No tools required");
        break;

      case "analysis":
        actions.push("Extract relevant data");
        actions.push("Perform analysis");
        actions.push("Present findings clearly");
        break;

      default:
        actions.push("Proceed with standard response");
    }

    return actions;
  }

  /**
   * Generate suggested clarifications for ambiguous requests.
   */
  private generateSuggestedClarifications(_text: string, ambiguities: string[]): string[] {
    const clarifications: string[] = [];

    for (const ambiguity of ambiguities) {
      switch (ambiguity) {
        case "missing_url":
          clarifications.push("Please provide the full URL including https://");
          break;

        case "vague_search":
          clarifications.push("Please provide more specific search terms");
          break;

        case "missing_path":
          clarifications.push("Please provide the full file path");
          break;

        case "ambiguous_pronoun":
          clarifications.push("Please replace pronouns with specific nouns");
          break;
      }
    }

    return clarifications;
  }

  /**
   * Generate clarification response for user.
   */
  generateClarificationResponse(text: string): string | null {
    const ambiguity = this.detectAmbiguity(text);

    if (!ambiguity.isAmbiguous) {
      return null;
    }

    const questions = ambiguity.clarificationQuestions;
    const suggestions = ambiguity.suggestedClarifications;

    let response = "I need some clarification:\n\n";
    response += questions.map(q => `- ${q}`).join("\n");

    if (suggestions.length > 0) {
      response += "\n\nSuggestions:\n";
      response += suggestions.map(s => `- ${s}`).join("\n");
    }

    return response;
  }

  /**
   * Check if request is clear enough for tool execution.
   */
  isRequestClear(text: string): { clear: boolean; reason?: string } {
    const ambiguity = this.detectAmbiguity(text);

    if (ambiguity.isAmbiguous) {
      return {
        clear: false,
        reason: `Ambiguous: ${ambiguity.ambiguityType}`
      };
    }

    const intent = this.detectIntent(text);

    if (intent.confidence < 0.3) {
      return {
        clear: false,
        reason: "Low confidence in intent detection"
      };
    }

    return { clear: true };
  }
}

// Global instance
export const intentClarifier = new IntentClarifier();
