import { TIMEOUT_CONFIG } from '../../../config/features';

type WaitOpts = { timeoutMs?: number, intervalMs?: number }

class UiDriverService {
  async waitVisible(selector: string, opts: WaitOpts = {}): Promise<Element> {
    const timeout = opts.timeoutMs ?? TIMEOUT_CONFIG.DEFAULT_UI_TIMEOUT_MS
    const interval = opts.intervalMs ?? TIMEOUT_CONFIG.DEFAULT_UI_INTERVAL_MS
    const start = Date.now()
    
    // Custom pseudo-selector handling
    const isTextMatch = selector.includes(':has-text(');
    let cssSelector = selector;
    let textTarget = '';
    
    if (isTextMatch) {
       const match = selector.match(/(.*):has-text\("(.+)"\)/);
       if (match) {
          cssSelector = match[1];
          textTarget = match[2];
       }
    }

    while (Date.now() - start < timeout) {
      let el: Element | null = null;
      if (isTextMatch && textTarget) {
         const candidates = document.querySelectorAll(cssSelector);
         for (let i = 0; i < candidates.length; i++) {
            if (candidates[i].textContent?.includes(textTarget)) {
               el = candidates[i];
               break;
            }
         }
      } else {
         el = document.querySelector(selector);
      }

      if (el && this.isVisible(el)) return el
      await new Promise(r => setTimeout(r, interval))
    }
    throw new Error(`Element not visible: ${selector}`)
  }

  async click(selector: string): Promise<void> {
    const el = await this.waitVisible(selector)
    const evt = new MouseEvent('click', { bubbles: true })
    el.dispatchEvent(evt)
  }

  async type(selector: string, text: string): Promise<void> {
    const el = await this.waitVisible(selector)
    const input = el as HTMLInputElement | HTMLTextAreaElement
    input.focus()
    input.value = text
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise(r => requestAnimationFrame(() => r(null)))
  }

  getText(selector: string): string {
    const el = document.querySelector(selector)
    return el ? (el.textContent ?? '') : ''
  }

  private isVisible(el: Element): boolean {
    const rect = (el as HTMLElement).getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }
}

export const uiDriver = new UiDriverService()
