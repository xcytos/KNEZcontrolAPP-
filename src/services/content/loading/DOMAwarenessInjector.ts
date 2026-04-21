// ─── DOMAwarenessInjector.ts ─────────────────────────────────────────────
// T11: DOM Awareness Injection — injects DOM state into tool context.
//     DOM state tracking: visible elements, scroll position, form state.
//     Integration: ToolResultValidator, AgentLoopService.
// ─────────────────────────────────────────────────────────────────────────────

export interface DOMState {
  url: string;
  title: string;
  scrollPosition: { x: number; y: number };
  visibleElements: DOMElement[];
  forms: FormState[];
  timestamp: number;
}

export interface DOMElement {
  tag: string;
  selector: string;
  text: string;
  visible: boolean;
  clickable: boolean;
  attributes: Record<string, string>;
}

export interface FormState {
  selector: string;
  inputs: FormInput[];
  submitButton?: string;
}

export interface FormInput {
  selector: string;
  type: string;
  name: string;
  value: string;
  required: boolean;
}

/**
 * DOM awareness injector for tracking and injecting DOM state.
 */
export class DOMAwarenessInjector {
  private domStates: Map<string, DOMState[]> = new Map(); // sessionId -> states

  /**
   * Capture DOM state from page snapshot.
   */
  captureDOMState(snapshot: any, sessionId: string): DOMState {
    const state: DOMState = {
      url: snapshot.url || '',
      title: snapshot.title || '',
      scrollPosition: {
        x: snapshot.scrollX || 0,
        y: snapshot.scrollY || 0
      },
      visibleElements: this.extractVisibleElements(snapshot),
      forms: this.extractFormStates(snapshot),
      timestamp: Date.now()
    };

    // Store state
    const states = this.domStates.get(sessionId) || [];
    states.push(state);
    this.domStates.set(sessionId, states);

    return state;
  }

  /**
   * Extract visible elements from snapshot.
   */
  private extractVisibleElements(snapshot: any): DOMElement[] {
    const elements: DOMElement[] = [];

    if (snapshot.elements && Array.isArray(snapshot.elements)) {
      for (const elem of snapshot.elements) {
        elements.push({
          tag: elem.tag || 'unknown',
          selector: elem.selector || '',
          text: elem.text || '',
          visible: elem.visible !== false,
          clickable: elem.clickable === true,
          attributes: elem.attributes || {}
        });
      }
    }

    return elements;
  }

  /**
   * Extract form states from snapshot.
   */
  private extractFormStates(snapshot: any): FormState[] {
    const forms: FormState[] = [];

    if (snapshot.forms && Array.isArray(snapshot.forms)) {
      for (const form of snapshot.forms) {
        const inputs: FormInput[] = [];
        
        if (form.inputs && Array.isArray(form.inputs)) {
          for (const input of form.inputs) {
            inputs.push({
              selector: input.selector || '',
              type: input.type || 'text',
              name: input.name || '',
              value: input.value || '',
              required: input.required === true
            });
          }
        }

        forms.push({
          selector: form.selector || '',
          inputs,
          submitButton: form.submitButton
        });
      }
    }

    return forms;
  }

  /**
   * Inject DOM state into tool context.
   */
  injectDOMState(toolName: string, args: any, sessionId: string): any {
    const states = this.domStates.get(sessionId);
    if (!states || states.length === 0) {
      return args;
    }

    const latestState = states[states.length - 1];
    
    // Inject relevant DOM information based on tool
    switch (toolName) {
      case 'puppeteer_click':
        return this.injectForClick(args, latestState);
      case 'puppeteer_fill':
        return this.injectForFill(args, latestState);
      case 'puppeteer_navigate':
        return this.injectForNavigate(args, latestState);
      case 'puppeteer_evaluate':
        return this.injectForEvaluate(args, latestState);
      default:
        return args;
    }
  }

  /**
   * Inject DOM state for click operations.
   */
  private injectForClick(args: any, state: DOMState): any {
    // Add scroll position to ensure element is visible
    return {
      ...args,
      scrollPosition: state.scrollPosition
    };
  }

  /**
   * Inject DOM state for fill operations.
   */
  private injectForFill(args: any, state: DOMState): any {
    // Add form context if filling a form input
    const selector = args.selector || '';
    const formContext = this.findFormForSelector(selector, state.forms);

    return {
      ...args,
      formContext: formContext || undefined
    };
  }

  /**
   * Inject DOM state for navigate operations.
   */
  private injectForNavigate(args: any, state: DOMState): any {
    // Add current URL for relative navigation
    return {
      ...args,
      currentUrl: state.url
    };
  }

  /**
   * Inject DOM state for evaluate operations.
   */
  private injectForEvaluate(args: any, state: DOMState): any {
    // Add DOM context for evaluation
    return {
      ...args,
      domContext: {
        url: state.url,
        title: state.title,
        scrollPosition: state.scrollPosition
      }
    };
  }

  /**
   * Find form for a selector.
   */
  private findFormForSelector(selector: string, forms: FormState[]): FormState | null {
    for (const form of forms) {
      for (const input of form.inputs) {
        if (selector.includes(input.selector) || input.selector.includes(selector)) {
          return form;
        }
      }
    }
    return null;
  }

  /**
   * Get DOM state history for a session.
   */
  getDOMStateHistory(sessionId: string): DOMState[] {
    return this.domStates.get(sessionId) || [];
  }

  /**
   * Get latest DOM state for a session.
   */
  getLatestDOMState(sessionId: string): DOMState | null {
    const states = this.domStates.get(sessionId);
    if (!states || states.length === 0) return null;
    return states[states.length - 1];
  }

  /**
   * Get DOM changes between two states.
   */
  getDOMChanges(sessionId: string, fromIndex: number, toIndex: number): {
    addedElements: DOMElement[];
    removedElements: DOMElement[];
    changedElements: DOMElement[];
  } | null {
    const states = this.domStates.get(sessionId);
    if (!states || states.length <= toIndex) return null;

    const fromState = states[fromIndex];
    const toState = states[toIndex];

    const addedElements: DOMElement[] = [];
    const removedElements: DOMElement[] = [];
    const changedElements: DOMElement[] = [];

    // Simple comparison based on selector
    const fromSelectors = new Set(fromState.visibleElements.map(e => e.selector));
    const toSelectors = new Set(toState.visibleElements.map(e => e.selector));

    for (const elem of toState.visibleElements) {
      if (!fromSelectors.has(elem.selector)) {
        addedElements.push(elem);
      }
    }

    for (const elem of fromState.visibleElements) {
      if (!toSelectors.has(elem.selector)) {
        removedElements.push(elem);
      }
    }

    for (const elem of toState.visibleElements) {
      const fromElem = fromState.visibleElements.find(e => e.selector === elem.selector);
      if (fromElem && fromElem.text !== elem.text) {
        changedElements.push(elem);
      }
    }

    return { addedElements, removedElements, changedElements };
  }

  /**
   * Get element visibility summary.
   */
  getElementVisibility(sessionId: string): {
    totalElements: number;
    visibleElements: number;
    clickableElements: number;
    formsCount: number;
  } | null {
    const state = this.getLatestDOMState(sessionId);
    if (!state) return null;

    return {
      totalElements: state.visibleElements.length,
      visibleElements: state.visibleElements.filter(e => e.visible).length,
      clickableElements: state.visibleElements.filter(e => e.clickable).length,
      formsCount: state.forms.length
    };
  }

  /**
   * Clear DOM state for a session.
   */
  clearDOMState(sessionId: string): void {
    this.domStates.delete(sessionId);
  }

  /**
   * Clear all DOM states.
   */
  clearAllDOMStates(): void {
    this.domStates.clear();
  }

  /**
   * Get active sessions with DOM state.
   */
  getActiveSessions(): string[] {
    return Array.from(this.domStates.keys());
  }
}

// Global instance
export const domAwarenessInjector = new DOMAwarenessInjector();
