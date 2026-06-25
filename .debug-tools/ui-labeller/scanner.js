/**
 * UI Component Scanner
 * Auto-detects React components and extracts their metadata
 */

class ComponentScanner {
  constructor(config) {
    this.config = config;
    this.components = new Map();
    this.observer = null;
  }

  /**
   * Initialize scanner and start detecting components
   */
  init() {
    this.scanDOM();
    this.setupMutationObserver();
    console.log('[UI Labeller] Scanner initialized');
  }

  /**
   * Scan the DOM for React components
   */
  scanDOM() {
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(el => {
      const componentInfo = this.detectComponent(el);
      if (componentInfo) {
        this.components.set(el, componentInfo);
      }
    });

    console.log(`[UI Labeller] Found ${this.components.size} components`);
    return Array.from(this.components.values());
  }

  /**
   * Detect if element is a React component and extract metadata
   */
  detectComponent(element) {
    // Check for React Fiber
    const fiberKey = Object.keys(element).find(key => 
      key.startsWith('__reactFiber') || 
      key.startsWith('__reactInternalInstance')
    );

    if (!fiberKey) {
      // Fallback: Check data attributes and IDs
      return this.detectByAttributes(element);
    }

    const fiber = element[fiberKey];
    const componentName = this.getComponentName(fiber);

    if (!componentName || componentName.startsWith('_')) {
      return null;
    }

    // Check if component is in target list
    if (this.config.targetComponents.length > 0 && 
        !this.config.targetComponents.includes(componentName)) {
      return null;
    }

    return this.extractMetadata(element, componentName);
  }

  /**
   * Fallback detection using HTML attributes
   */
  detectByAttributes(element) {
    const id = element.id;
    const classList = Array.from(element.classList);
    
    // Check for common component patterns
    const componentPatterns = [
      { pattern: /^(hero|navbar|footer|sidebar)/i, type: 'section' },
      { pattern: /search.*bar/i, type: 'component' },
      { pattern: /card/i, type: 'component' },
      { pattern: /button/i, type: 'component' },
      { pattern: /modal/i, type: 'component' }
    ];

    for (const { pattern, type } of componentPatterns) {
      if (pattern.test(id)) {
        return this.extractMetadata(element, id, type);
      }
      
      for (const className of classList) {
        if (pattern.test(className)) {
          return this.extractMetadata(element, className, type);
        }
      }
    }

    return null;
  }

  /**
   * Get component name from React Fiber
   */
  getComponentName(fiber) {
    if (!fiber) return null;

    let currentFiber = fiber;
    
    while (currentFiber) {
      const { type, elementType } = currentFiber;
      
      if (typeof type === 'function') {
        return type.displayName || type.name;
      }
      
      if (typeof elementType === 'function') {
        return elementType.displayName || elementType.name;
      }

      currentFiber = currentFiber.return;
    }

    return null;
  }

  /**
   * Extract component metadata (dimensions, spacing, etc.)
   */
  extractMetadata(element, name, type = 'component') {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    return {
      name,
      type,
      element,
      dimensions: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom)
      },
      spacing: {
        marginTop: parseInt(styles.marginTop) || 0,
        marginRight: parseInt(styles.marginRight) || 0,
        marginBottom: parseInt(styles.marginBottom) || 0,
        marginLeft: parseInt(styles.marginLeft) || 0,
        paddingTop: parseInt(styles.paddingTop) || 0,
        paddingRight: parseInt(styles.paddingRight) || 0,
        paddingBottom: parseInt(styles.paddingBottom) || 0,
        paddingLeft: parseInt(styles.paddingLeft) || 0
      },
      position: {
        position: styles.position,
        zIndex: styles.zIndex !== 'auto' ? parseInt(styles.zIndex) : null
      },
      display: styles.display
    };
  }

  /**
   * Setup mutation observer to detect dynamic components
   */
  setupMutationObserver() {
    this.observer = new MutationObserver(() => {
      this.scanDOM();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Stop observer
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.components.clear();
  }

  /**
   * Export component data
   */
  export() {
    const data = Array.from(this.components.values());
    return {
      timestamp: new Date().toISOString(),
      totalComponents: data.length,
      components: data.map(c => ({
        name: c.name,
        type: c.type,
        dimensions: c.dimensions,
        spacing: c.spacing,
        position: c.position
      }))
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComponentScanner;
}
