/**
 * UI Component Overlay Renderer
 * Renders visual labels and boundaries over components
 */

class ComponentOverlay {
  constructor(config, scanner) {
    this.config = config;
    this.scanner = scanner;
    this.overlayContainer = null;
    this.isVisible = false;
    this.labels = new Map();
  }

  /**
   * Initialize overlay system
   */
  init() {
    this.createOverlayContainer();
    this.setupKeyboardShortcut();
    console.log('[UI Labeller] Overlay initialized');
  }

  /**
   * Create overlay container
   */
  createOverlayContainer() {
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'ui-labeller-overlay';
    this.overlayContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 999999;
      display: none;
    `;
    document.body.appendChild(this.overlayContainer);
  }

  /**
   * Setup keyboard shortcut to toggle overlay
   */
  setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+D
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Toggle overlay visibility
   */
  toggle() {
    this.isVisible = !this.isVisible;
    
    if (this.isVisible) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Show overlay
   */
  show() {
    this.overlayContainer.style.display = 'block';
    this.render();
    console.log('[UI Labeller] Overlay visible');
  }

  /**
   * Hide overlay
   */
  hide() {
    this.overlayContainer.style.display = 'none';
    console.log('[UI Labeller] Overlay hidden');
  }

  /**
   * Render all component labels and boundaries
   */
  render() {
    // Clear existing labels
    this.overlayContainer.innerHTML = '';
    this.labels.clear();

    // Get all components from scanner
    const components = this.scanner.scanDOM();

    components.forEach(component => {
      this.renderComponent(component);
    });
  }

  /**
   * Render individual component overlay
   */
  renderComponent(component) {
    const { name, dimensions, spacing, position, type } = component;
    const { width, height, top, left } = dimensions;

    // Create boundary box
    const boundary = this.createBoundary(component);
    this.overlayContainer.appendChild(boundary);

    // Create label
    const label = this.createLabel(component);
    this.overlayContainer.appendChild(label);

    // Show spacing if enabled
    if (this.config.showSpacing) {
      const spacingOverlay = this.createSpacingOverlay(component);
      if (spacingOverlay) {
        this.overlayContainer.appendChild(spacingOverlay);
      }
    }

    this.labels.set(component.element, { boundary, label });
  }

  /**
   * Create boundary box for component
   */
  createBoundary(component) {
    const { dimensions, type } = component;
    const { width, height, top, left } = dimensions;

    const boundary = document.createElement('div');
    boundary.className = 'ui-labeller-boundary';
    boundary.style.cssText = `
      position: fixed;
      top: ${top}px;
      left: ${left}px;
      width: ${width}px;
      height: ${height}px;
      border: 2px solid ${this.config.colorScheme.border};
      background: ${this.config.colorScheme[type] || this.config.colorScheme.component};
      pointer-events: none;
      box-sizing: border-box;
    `;

    return boundary;
  }

  /**
   * Create label for component
   */
  createLabel(component) {
    const { name, dimensions, position } = component;
    const { width, height, top, left } = dimensions;

    const label = document.createElement('div');
    label.className = 'ui-labeller-label';
    
    let labelText = `<strong>${name}</strong>`;
    
    if (this.config.showDimensions) {
      labelText += `<br/>${width}px × ${height}px`;
    }
    
    if (this.config.showZIndex && position.zIndex !== null) {
      labelText += `<br/>z-index: ${position.zIndex}`;
    }

    label.innerHTML = labelText;
    label.style.cssText = `
      position: fixed;
      top: ${top - 2}px;
      left: ${left}px;
      background: rgba(0, 0, 0, 0.85);
      color: ${this.config.colorScheme.text};
      padding: 4px 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.4;
      border-radius: 3px;
      pointer-events: none;
      white-space: nowrap;
      transform: translateY(-100%);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;

    return label;
  }

  /**
   * Create spacing overlay (margin/padding visualization)
   */
  createSpacingOverlay(component) {
    const { dimensions, spacing } = component;
    const { top, left, width, height } = dimensions;

    if (!spacing.marginTop && !spacing.marginBottom && 
        !spacing.marginLeft && !spacing.marginRight &&
        !spacing.paddingTop && !spacing.paddingBottom &&
        !spacing.paddingLeft && !spacing.paddingRight) {
      return null;
    }

    const spacingContainer = document.createElement('div');
    spacingContainer.className = 'ui-labeller-spacing';
    spacingContainer.style.cssText = `
      position: fixed;
      pointer-events: none;
    `;

    // Margin visualization
    if (this.config.spacing.showMargin) {
      const margin = this.createMarginBoxes(component);
      margin.forEach(box => spacingContainer.appendChild(box));
    }

    // Padding visualization
    if (this.config.spacing.showPadding) {
      const padding = this.createPaddingBoxes(component);
      padding.forEach(box => spacingContainer.appendChild(box));
    }

    return spacingContainer;
  }

  /**
   * Create margin boxes
   */
  createMarginBoxes(component) {
    const { dimensions, spacing } = component;
    const { top, left, width, height } = dimensions;
    const boxes = [];

    // Top margin
    if (spacing.marginTop > 0) {
      const box = document.createElement('div');
      box.style.cssText = `
        position: fixed;
        top: ${top - spacing.marginTop}px;
        left: ${left}px;
        width: ${width}px;
        height: ${spacing.marginTop}px;
        background: ${this.config.spacing.marginColor};
        border: 1px dashed rgba(251, 191, 36, 0.6);
      `;
      boxes.push(box);
    }

    // Bottom margin
    if (spacing.marginBottom > 0) {
      const box = document.createElement('div');
      box.style.cssText = `
        position: fixed;
        top: ${top + height}px;
        left: ${left}px;
        width: ${width}px;
        height: ${spacing.marginBottom}px;
        background: ${this.config.spacing.marginColor};
        border: 1px dashed rgba(251, 191, 36, 0.6);
      `;
      boxes.push(box);
    }

    return boxes;
  }

  /**
   * Create padding boxes
   */
  createPaddingBoxes(component) {
    const { dimensions, spacing } = component;
    const { top, left, width, height } = dimensions;
    const boxes = [];

    // Top padding
    if (spacing.paddingTop > 0) {
      const box = document.createElement('div');
      box.style.cssText = `
        position: fixed;
        top: ${top}px;
        left: ${left}px;
        width: ${width}px;
        height: ${spacing.paddingTop}px;
        background: ${this.config.spacing.paddingColor};
        border: 1px dashed rgba(34, 197, 94, 0.6);
      `;
      boxes.push(box);
    }

    // Bottom padding
    if (spacing.paddingBottom > 0) {
      const box = document.createElement('div');
      box.style.cssText = `
        position: fixed;
        top: ${top + height - spacing.paddingBottom}px;
        left: ${left}px;
        width: ${width}px;
        height: ${spacing.paddingBottom}px;
        background: ${this.config.spacing.paddingColor};
        border: 1px dashed rgba(34, 197, 94, 0.6);
      `;
      boxes.push(box);
    }

    return boxes;
  }

  /**
   * Update overlay on window resize or scroll
   */
  update() {
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * Destroy overlay
   */
  destroy() {
    if (this.overlayContainer) {
      this.overlayContainer.remove();
    }
    this.labels.clear();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComponentOverlay;
}
