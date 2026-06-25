/**
 * UI Labeller v4 - DevTools-style Element Inspector
 * Clean hover-only inspection with click-to-copy
 * No overlay clutter, no config fetch, works across navigation
 */

(function() {
  'use strict';

  console.log('[UI Labeller v4] Initializing...');

  // Simple inline config
  const config = {
    enabled: true,
    hotkey: 'ctrl+shift+d'
  };

  // ElementInspector - DevTools-style element picker
  class ElementInspector {
    constructor(config) {
      this.config = config;
      this.isActive = false;
      this.hoveredElement = null;
      this.highlightEl = null;
      this.labelEl = null;
      this.statusEl = null;
    }

    init() {
      this.createOverlays();
      this.setupKeyboard();
      this.setupNavigation();
    }

    createOverlays() {
      // Highlight box
      this.highlightEl = document.createElement('div');
      this.highlightEl.id = 'uilab-highlight';
      this.highlightEl.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483646;
        display: none;
        border: 2px solid #1a73e8;
        background: rgba(26, 115, 232, 0.1);
        box-sizing: border-box;
      `;
      
      // Label tooltip
      this.labelEl = document.createElement('div');
      this.labelEl.id = 'uilab-label';
      this.labelEl.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        display: none;
        background: rgba(26, 115, 232, 0.95);
        color: white;
        padding: 6px 10px;
        font-family: system-ui, sans-serif;
        font-size: 11px;
        line-height: 1.4;
        border-radius: 2px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        max-width: 400px;
        word-wrap: break-word;
      `;
      
      // Toggle button - ALWAYS visible
      this.toggleBtn = document.createElement('button');
      this.toggleBtn.id = 'uilab-toggle-btn';
      this.toggleBtn.innerHTML = '🎯';
      this.toggleBtn.title = 'Toggle UI Inspector (Ctrl+Shift+D)';
      this.toggleBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      this.toggleBtn.onmouseover = () => {
        this.toggleBtn.style.transform = 'scale(1.1)';
        this.toggleBtn.style.boxShadow = '0 6px 25px rgba(102, 126, 234, 0.6)';
      };
      this.toggleBtn.onmouseout = () => {
        this.toggleBtn.style.transform = 'scale(1)';
        this.toggleBtn.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.4)';
      };
      this.toggleBtn.onclick = () => this.toggle();
      
      // Status bar - shows when active
      this.statusEl = document.createElement('div');
      this.statusEl.id = 'uilab-status';
      this.statusEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483645;
        display: none;
        background: rgba(0, 0, 0, 0.9);
        color: #4ade80;
        padding: 12px 20px;
        font-family: system-ui, sans-serif;
        font-size: 13px;
        font-weight: 600;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        cursor: pointer;
        user-select: none;
        border: 2px solid #4ade80;
      `;
      this.statusEl.textContent = '🎯 Inspector Active - Hover over elements';
      this.statusEl.onclick = () => this.stop();
      
      document.body.appendChild(this.highlightEl);
      document.body.appendChild(this.labelEl);
      document.body.appendChild(this.toggleBtn);
      document.body.appendChild(this.statusEl);
    }

    setupKeyboard() {
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
          e.preventDefault();
          this.toggle();
        }
        if (e.key === 'Escape' && this.isActive) {
          e.preventDefault();
          this.stop();
        }
      });
    }

    setupNavigation() {
      // Detect page navigation and reinit
      let lastUrl = location.href;
      new MutationObserver(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          if (this.isActive) {
            this.stop();
            setTimeout(() => this.start(), 100);
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
      
      window.addEventListener('popstate', () => {
        if (this.isActive) {
          this.stop();
          setTimeout(() => this.start(), 100);
        }
      });
    }

    toggle() {
      this.isActive ? this.stop() : this.start();
    }

    start() {
      if (this.isActive) return;
      
      this.isActive = true;
      this.statusEl.style.display = 'block';
      this.toggleBtn.innerHTML = '⏹️'; // Stop icon when active
      this.toggleBtn.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
      document.body.style.cursor = 'crosshair';
      
      this.onMouseMove = this.handleMouseMove.bind(this);
      this.onClick = this.handleClick.bind(this);
      
      document.addEventListener('mousemove', this.onMouseMove, true);
      document.addEventListener('click', this.onClick, true);
      
      console.log('[UI Labeller] Started - Hover over elements to inspect');
    }

    stop() {
      if (!this.isActive) return;
      
      this.isActive = false;
      this.statusEl.style.display = 'none';
      this.highlightEl.style.display = 'none';
      this.labelEl.style.display = 'none';
      this.toggleBtn.innerHTML = '🎯'; // Target icon when inactive
      this.toggleBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      document.body.style.cursor = '';
      
      document.removeEventListener('mousemove', this.onMouseMove, true);
      document.removeEventListener('click', this.onClick, true);
      
      this.hoveredElement = null;
      console.log('[UI Labeller] Stopped');
    }

    handleMouseMove(e) {
      const target = e.target;
      
      // Skip our own elements
      if (target.id?.startsWith('uilab-') || 
          target.closest('[id^="uilab-"]')) {
        return;
      }
      
      if (target === this.hoveredElement) return;
      
      this.hoveredElement = target;
      this.showHighlight(target);
    }

    handleClick(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const target = e.target;
      
      // Skip our own elements
      if (target.id?.startsWith('uilab-')) return;
      
      this.copyElementInfo(target);
    }

    showHighlight(el) {
      const rect = el.getBoundingClientRect();
      const info = this.getInfo(el);
      
      // Update highlight
      this.highlightEl.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483646;
        display: block;
        border: 2px solid #1a73e8;
        background: rgba(26, 115, 232, 0.1);
        box-sizing: border-box;
        top: ${rect.top}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
      `;
      
      // Update label
      this.labelEl.innerHTML = this.formatLabel(info);
      
      // Position label
      const labelH = 60;
      let top = rect.top - labelH - 4;
      if (top < 0) top = rect.bottom + 4;
      
      this.labelEl.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        display: block;
        background: rgba(26, 115, 232, 0.95);
        color: white;
        padding: 6px 10px;
        font-family: system-ui, sans-serif;
        font-size: 11px;
        line-height: 1.4;
        border-radius: 2px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        max-width: 400px;
        word-wrap: break-word;
        top: ${top}px;
        left: ${rect.left}px;
      `;
    }

    getInfo(el) {
      const rect = el.getBoundingClientRect();
      const tag = el.tagName.toLowerCase();
      
      let componentName = null;
      let fileLocation = null;
      let componentChain = [];
      
      // List of framework/library components to skip
      const skipComponents = [
        'SegmentViewNode', 'Fragment', 'LinkComponent', 'ForwardRef', 'Memo',
        'InnerLayoutRouter', 'RedirectErrorBoundary', 'RedirectBoundary',
        'OuterLayoutRouter', 'RenderFromTemplateContext', 'ScrollAndFocusHandler',
        'ErrorBoundary', 'GlobalError', 'NotFoundErrorBoundary',
        'ClientPageRoot', 'TemplateContext', 'HotReload', 'ReactDevOverlay',
        'AppRouter', 'StaticGenerationSearchParamsBailoutProvider',
        // Next.js 16 Turbopack components
        'HTTPAccessFallbackErrorBoundary', 'HTTPAccessFallbackBoundary', 'LoadingBoundary',
        'Suspense', 'SuspenseList', 'Offscreen', 'Context', 'Provider', 'Consumer',
        // Next.js 16 Error & Scroll handlers
        'ErrorBoundaryHandler', 'InnerScrollAndFocusHandlerOld', 'ScrollAndMaybeFocusHandler',
        'InnerScrollAndFocusHandler', 'FocusAndScrollHandler', 'NotFoundBoundary',
        // State & Context Providers
        'SegmentStateProvider', 'AuthProvider', '__next_root_layout_boundary__',
        'ServerInsertedHTMLContext', 'AppRouterContext', 'LayoutRouterContext'
      ];
      
      // STRATEGY 1: Semantic detection from DOM structure and context
      componentName = this.detectSemanticComponent(el);
      
      // STRATEGY 2: Try React Fiber if semantic detection failed
      if (!componentName || componentName === tag) {
        const fiberResult = this.detectFromFiber(el, skipComponents);
        if (fiberResult.componentName && fiberResult.componentName !== tag) {
          componentName = fiberResult.componentName;
        }
        componentChain = fiberResult.componentChain;
        fileLocation = fiberResult.fileLocation;
      }
      
      // STRATEGY 3: Final fallback - use tag notation
      if (!componentName || componentName === tag) {
        componentName = `<${tag}>`;
      }
      
      // Get computed styles for color metrics
      const styles = window.getComputedStyle(el);
      const colors = this.getColorMetrics(el, styles);
      
      // Get text for interactive elements
      let text = '';
      if (['button', 'a', 'h1', 'h2', 'h3'].includes(tag)) {
        text = el.textContent.trim().replace(/\s+/g, ' ').substring(0, 40);
      }
      
      // Build component path
      let componentPath = componentName;
      if (componentChain.length > 0 && !componentChain.includes(componentName)) {
        componentPath = [componentName, ...componentChain.slice(0, 2)].join(' → ');
      }
      
      return {
        componentName,
        componentPath,
        tag,
        text,
        fileLocation,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        classes: Array.from(el.classList).slice(0, 5).join(' '),
        colors: colors
      };
    }
    
    getColorMetrics(el, styles) {
      // Get computed colors
      const bgColor = styles.backgroundColor;
      const textColor = styles.color;
      const borderColor = styles.borderColor || styles.borderTopColor;
      
      // Convert rgba/rgb to hex for readability
      const toHex = (color) => {
        if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
          return null;
        }
        
        // Parse rgb/rgba
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return color;
        
        const [, r, g, b, a] = match;
        const alpha = a ? parseFloat(a) : 1;
        
        // If transparent, return null
        if (alpha === 0) return null;
        
        // Convert to hex
        const hex = '#' + [r, g, b].map(x => {
          const hex = parseInt(x).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('');
        
        // Add alpha if not fully opaque
        if (alpha < 1) {
          return `${hex} (${Math.round(alpha * 100)}%)`;
        }
        
        return hex;
      };
      
      // Find actual background color (walk up tree if transparent)
      let actualBgColor = toHex(bgColor);
      if (!actualBgColor) {
        let parent = el.parentElement;
        let depth = 0;
        while (parent && depth < 10) {
          const parentBg = window.getComputedStyle(parent).backgroundColor;
          actualBgColor = toHex(parentBg);
          if (actualBgColor) break;
          parent = parent.parentElement;
          depth++;
        }
        if (!actualBgColor) actualBgColor = '#ffffff'; // Default to white
      }
      
      return {
        background: actualBgColor,
        text: toHex(textColor),
        border: toHex(borderColor)
      };
    }
    
    detectSemanticComponent(el) {
      const tag = el.tagName.toLowerCase();
      const classes = Array.from(el.classList);
      const id = el.id;
      
      // Check parent elements for context (walk up DOM)
      let current = el;
      let depth = 0;
      while (current && depth < 10) {
        const parentClasses = Array.from(current.classList);
        const parentId = current.id;
        
        // Hero section detection
        if (parentClasses.some(c => c.includes('hero'))) {
          if (tag === 'h1') return 'Hero.Heading';
          if (tag === 'p' || tag === 'span') return 'Hero.Text';
          if (tag === 'button') return 'Hero.Button';
          if (tag === 'input') return 'Hero.SearchInput';
          if (tag === 'form') return 'Hero.SearchForm';
          if (parentClasses.some(c => c.includes('search'))) return 'Hero.SearchBar';
          return 'Hero.Element';
        }
        
        // Navbar detection
        if (parentClasses.some(c => c.includes('navbar') || c.includes('nav-') || c.includes('header'))) {
          if (tag === 'a') return 'Navbar.Link';
          if (tag === 'button') return 'Navbar.Button';
          if (tag === 'img' || tag === 'svg') return 'Navbar.Logo';
          return 'Navbar.Element';
        }
        
        // Footer detection
        if (parentClasses.some(c => c.includes('footer'))) {
          if (tag === 'a') return 'Footer.Link';
          if (tag === 'p' || tag === 'span') return 'Footer.Text';
          return 'Footer.Element';
        }
        
        // Card detection
        if (parentClasses.some(c => c.includes('card'))) {
          if (tag === 'h1' || tag === 'h2' || tag === 'h3') return 'Card.Heading';
          if (tag === 'img') return 'Card.Image';
          if (tag === 'p') return 'Card.Description';
          if (tag === 'button') return 'Card.Action';
          return 'Card.Element';
        }
        
        // Modal/Dialog detection
        if (parentClasses.some(c => c.includes('modal') || c.includes('dialog'))) {
          if (tag === 'h1' || tag === 'h2') return 'Modal.Heading';
          if (tag === 'button') return 'Modal.Button';
          return 'Modal.Element';
        }
        
        current = current.parentElement;
        depth++;
      }
      
      // Element-level detection (no parent context found)
      if (id) {
        // Convert kebab-case to PascalCase
        const idName = id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
        if (tag === 'h1' || tag === 'h2' || tag === 'h3') return `${idName}.Heading`;
        return idName;
      }
      
      // Class-based detection
      if (classes.some(c => c.includes('hero'))) return 'Hero';
      if (classes.some(c => c.includes('navbar'))) return 'Navbar';
      if (classes.some(c => c.includes('footer'))) return 'Footer';
      if (classes.some(c => c.includes('card'))) return 'Card';
      if (classes.some(c => c.includes('modal'))) return 'Modal';
      if (classes.some(c => c.includes('search'))) return 'SearchBar';
      if (classes.some(c => c.includes('carousel'))) return 'Carousel';
      if (classes.some(c => c.includes('container'))) return 'Container';
      
      // Semantic HTML tags
      if (tag === 'nav') return 'Navigation';
      if (tag === 'header') return 'Header';
      if (tag === 'footer') return 'Footer';
      if (tag === 'aside') return 'Sidebar';
      if (tag === 'main') return 'Main';
      if (tag === 'article') return 'Article';
      if (tag === 'section') return 'Section';
      
      return null;
    }
    
    detectFromFiber(el, skipComponents) {
      let componentName = null;
      let fileLocation = null;
      let componentChain = [];
      
      // Try React Fiber - walk up the tree aggressively
      const fiberKey = Object.keys(el).find(k => 
        k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
      );
      
      if (fiberKey) {
        let fiber = el[fiberKey];
        let depth = 0;
        
        while (fiber && depth < 40) {
          // Get name
          const { type, elementType } = fiber;
          let name = null;
          
          if (typeof type === 'function') {
            name = type.displayName || type.name;
          } else if (typeof elementType === 'function') {
            name = elementType.displayName || elementType.name;
          }
          
          // Only include user components (skip framework internals)
          if (name && !skipComponents.includes(name)) {
            if (!componentName) componentName = name;
            if (componentChain.length < 3 && !componentChain.includes(name)) {
              componentChain.push(name);
            }
          }
          
          // Get location from first meaningful component
          if (fiber._debugSource && !fileLocation && name && !skipComponents.includes(name)) {
            const s = fiber._debugSource;
            const pathParts = s.fileName.split('/');
            const file = pathParts[pathParts.length - 1];
            fileLocation = `${file}:${s.lineNumber}`;
          }
          
          // Turbopack workaround: Try to extract filename from component function source
          if (!fileLocation && !skipComponents.includes(name) && typeof type === 'function') {
            try {
              const funcString = type.toString();
              // Look for webpack/turbopack module comments like /* __TURBOPACK__imported__module__... */
              const moduleMatch = funcString.match(/\/\*.*?([A-Z][a-zA-Z]+\.tsx?).*?\*\//);
              if (moduleMatch) {
                fileLocation = moduleMatch[1];
              }
            } catch (e) {
              // Ignore errors
            }
          }
          
          fiber = fiber.return;
          depth++;
        }
      }
      
      return { componentName, fileLocation, componentChain };
    }

    formatLabel(info) {
      let html = `<div style="font-weight:600;margin-bottom:2px;">`;
      html += info.componentPath || info.componentName;
      if (info.tag !== info.componentName.toLowerCase()) {
        html += ` <span style="opacity:0.7;font-weight:400;">&lt;${info.tag}&gt;</span>`;
      }
      html += `</div>`;
      
      if (info.text) {
        html += `<div style="opacity:0.8;font-size:10px;margin-bottom:2px;">"${info.text}"</div>`;
      }
      
      html += `<div style="opacity:0.7;font-size:10px;">`;
      html += `${info.width}px × ${info.height}px`;
      html += `</div>`;
      
      // Color metrics
      if (info.colors) {
        html += `<div style="display:flex;gap:8px;margin-top:4px;align-items:center;">`;
        
        // Background color
        if (info.colors.background) {
          html += `<div style="display:flex;align-items:center;gap:3px;font-size:9px;">`;
          html += `<div style="width:14px;height:14px;border-radius:2px;background:${info.colors.background};border:1px solid rgba(255,255,255,0.3);"></div>`;
          html += `<span style="opacity:0.8;">${info.colors.background}</span>`;
          html += `</div>`;
        }
        
        // Text color
        if (info.colors.text) {
          html += `<div style="display:flex;align-items:center;gap:3px;font-size:9px;">`;
          html += `<div style="width:14px;height:14px;border-radius:2px;background:${info.colors.text};border:1px solid rgba(255,255,255,0.3);"></div>`;
          html += `<span style="opacity:0.8;">${info.colors.text}</span>`;
          html += `</div>`;
        }
        
        html += `</div>`;
        
        // Border color on new line if exists
        if (info.colors.border && info.colors.border !== 'transparent') {
          html += `<div style="display:flex;align-items:center;gap:3px;font-size:9px;margin-top:2px;">`;
          html += `<span style="opacity:0.6;">Border:</span>`;
          html += `<div style="width:14px;height:14px;border-radius:2px;background:${info.colors.border};border:1px solid rgba(255,255,255,0.3);"></div>`;
          html += `<span style="opacity:0.8;">${info.colors.border}</span>`;
          html += `</div>`;
        }
      }
      
      if (info.fileLocation) {
        html += `<div style="opacity:0.9;font-size:10px;margin-top:4px;color:#fbbf24;">📁 ${info.fileLocation}</div>`;
      } else {
        html += `<div style="opacity:0.6;font-size:9px;margin-top:2px;font-style:italic;">⚠️ No source location</div>`;
      }
      
      if (info.classes) {
        html += `<div style="opacity:0.6;font-size:9px;margin-top:2px;">${info.classes}</div>`;
      }
      
      return html;
    }

    copyElementInfo(el) {
      const info = this.getInfo(el);
      
      const output = {
        component: info.componentName,
        componentPath: info.componentPath || info.componentName,
        tag: info.tag,
        text: info.text || '',
        location: info.fileLocation || 'N/A (Turbopack limitation)',
        dimensions: `${info.width}×${info.height}`,
        colors: {
          background: info.colors.background || 'transparent',
          text: info.colors.text || 'inherit',
          border: info.colors.border || 'none'
        },
        classes: info.classes || '',
        selector: this.getCssSelector(el)
      };
      
      navigator.clipboard.writeText(JSON.stringify(output, null, 2))
        .then(() => {
          this.statusEl.textContent = '✅ Copied to clipboard!';
          this.statusEl.style.background = 'rgba(34, 197, 94, 0.95)';
          console.log('[UI Labeller] Copied:', output);
          
          setTimeout(() => {
            if (this.isActive) {
              this.statusEl.textContent = '🎯 Inspector Active - Hover over elements';
              this.statusEl.style.background = 'rgba(0, 0, 0, 0.9)';
            }
          }, 2000);
        })
        .catch(err => {
          console.error('[UI Labeller] Copy failed:', err);
          this.statusEl.textContent = '❌ Copy failed';
          this.statusEl.style.background = 'rgba(239, 68, 68, 0.95)';
        });
    }
    
    getCssSelector(el) {
      if (el.id) return `#${el.id}`;
      
      const classes = Array.from(el.classList).slice(0, 2);
      if (classes.length > 0) {
        return `${el.tagName.toLowerCase()}.${classes.join('.')}`;
      }
      
      return el.tagName.toLowerCase();
    }
  }

  // Initialize after class definition
  function init() {
    if (!config.enabled) {
      console.log('[UI Labeller] Disabled');
      return;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initInspector);
    } else {
      initInspector();
    }
  }

  function initInspector() {
    const inspector = new ElementInspector(config);
    inspector.init();

    window.uiLabeller = {
      toggle: () => inspector.toggle(),
      start: () => inspector.start(),
      stop: () => inspector.stop(),
      isActive: () => inspector.isActive,
      config: config
    };

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UI LABELLER v4 - ELEMENT INSPECTOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Press Ctrl+Shift+D to toggle inspector
📋 Click any element to copy its details

Commands:
  window.uiLabeller.toggle()  - Toggle inspector
  window.uiLabeller.start()   - Start inspector
  window.uiLabeller.stop()    - Stop inspector

Features:
  • DevTools-style hover highlighting
  • Real component names from React Fiber
  • File locations (when available)
  • Click to copy JSON details
  • Works across page navigation
  • No overlay clutter

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }

  // Start initialization
  init();

})();
