"""
CDP Bridge - Chrome DevTools Protocol automation for Tauri WebView2
TRUE BACKGROUND AUTOMATION - No cursor interference
"""

import json
import websocket
import requests
from typing import Dict, List, Optional, Any
from pathlib import Path


class CDPBridge:
    """
    Chrome DevTools Protocol bridge for background automation
    Connects to Tauri WebView2 on port 9222 (if enabled)
    """
    
    def __init__(self, cdp_port: int = 9222):
        self.cdp_port = cdp_port
        self.ws = None
        self.target_id = None
        self.session_id = None
        self.message_id = 0
        
    def connect(self) -> bool:
        """Connect to CDP endpoint"""
        try:
            # Get list of targets
            response = requests.get(f"http://localhost:{self.cdp_port}/json")
            targets = response.json()
            
            if not targets:
                print(f"   No CDP targets found on port {self.cdp_port}")
                return False
            
            # Use first target (main window)
            target = targets[0]
            self.target_id = target['id']
            ws_url = target['webSocketDebuggerUrl']
            
            # Connect WebSocket
            self.ws = websocket.create_connection(ws_url)
            
            # Enable DOM domain
            self._send_command("DOM.enable")
            self._send_command("Runtime.enable")
            
            print(f"   [OK] Connected to CDP target: {target.get('title', 'Unknown')}")
            return True
            
        except Exception as e:
            print(f"   [ERROR] CDP connection failed: {e}")
            print(f"   [TIP] Make sure Tauri is running with:")
            print(f"      $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port={self.cdp_port}'")
            return False
    
    def is_connected(self) -> bool:
        """Check if connected"""
        return self.ws is not None
    
    def _send_command(self, method: str, params: Dict = None) -> Dict:
        """Send CDP command"""
        self.message_id += 1
        message = {
            "id": self.message_id,
            "method": method,
            "params": params or {}
        }
        
        self.ws.send(json.dumps(message))
        
        # Wait for response
        while True:
            response = json.loads(self.ws.recv())
            if response.get('id') == self.message_id:
                return response
    
    def execute_script(self, script: str) -> Any:
        """Execute JavaScript in page context"""
        result = self._send_command("Runtime.evaluate", {
            "expression": script,
            "returnByValue": True
        })
        
        if 'result' in result and 'result' in result['result']:
            return result['result']['result'].get('value')
        
        return None
    
    def get_elements(self, mode: str = 'fast') -> List[Dict[str, Any]]:
        """Get UI elements via DOM inspection"""
        # Query all interactive elements
        script = """
        (function() {
            const elements = [];
            const selectors = [
                'button', 'a', 'input', '[role="button"]', 
                '[role="tab"]', '[role="menu"]', '[role="menuitem"]',
                'select', 'textarea'
            ];
            
            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach((el, idx) => {
                    const rect = el.getBoundingClientRect();
                    const styles = window.getComputedStyle(el);
                    
                    // Only visible elements
                    if (rect.width > 0 && rect.height > 0 && 
                        styles.visibility !== 'hidden' && 
                        styles.display !== 'none') {
                        
                        elements.push({
                            id: el.id || `elem_${idx}_${selector}`,
                            label: el.textContent?.trim() || el.getAttribute('aria-label') || el.value || el.placeholder || 'N/A',
                            type: el.tagName.toLowerCase(),
                            role: el.getAttribute('role') || el.type || 'element',
                            visible: true,
                            enabled: !el.disabled,
                            bounds: {
                                left: rect.left,
                                top: rect.top,
                                right: rect.right,
                                bottom: rect.bottom,
                                width: rect.width,
                                height: rect.height
                            },
                            selector: el.id ? `#${el.id}` : `${selector}:nth-of-type(${idx + 1})`
                        });
                    }
                });
            });
            
            return elements;
        })();
        """
        
        elements = self.execute_script(script)
        return elements or []
    
    def click_element(self, element: Dict) -> bool:
        """Click element via JavaScript (TRUE BACKGROUND CLICK)"""
        try:
            selector = element.get('selector')
            if not selector:
                # Fallback: use label
                label = element.get('label')
                script = f"""
                (function() {{
                    const elements = Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]'));
                    const target = elements.find(el => el.textContent.includes("{label}"));
                    if (target) {{
                        target.click();
                        return true;
                    }}
                    return false;
                }})();
                """
            else:
                script = f"""
                (function() {{
                    const el = document.querySelector('{selector}');
                    if (el) {{
                        el.click();
                        return true;
                    }}
                    return false;
                }})();
                """
            
            result = self.execute_script(script)
            return result == True
            
        except Exception as e:
            print(f"   [ERROR] Click failed: {e}")
            return False
    
    def type_text(self, element: Dict, text: str) -> bool:
        """Type text via JavaScript (TRUE BACKGROUND TYPING)"""
        try:
            selector = element.get('selector')
            if not selector:
                return False
            
            # Escape text for JavaScript
            escaped_text = text.replace("'", "\\'").replace('"', '\\"')
            
            script = f"""
            (function() {{
                const el = document.querySelector('{selector}');
                if (el) {{
                    el.value = '{escaped_text}';
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return true;
                }}
                return false;
            }})();
            """
            
            result = self.execute_script(script)
            return result == True
            
        except Exception as e:
            print(f"   [ERROR] Type failed: {e}")
            return False
    
    def hover_element(self, element: Dict) -> bool:
        """Hover via JavaScript (simulated)"""
        try:
            selector = element.get('selector')
            if not selector:
                return False
            
            script = f"""
            (function() {{
                const el = document.querySelector('{selector}');
                if (el) {{
                    el.dispatchEvent(new MouseEvent('mouseover', {{ bubbles: true }}));
                    return true;
                }}
                return false;
            }})();
            """
            
            result = self.execute_script(script)
            return result == True
            
        except Exception as e:
            return False
    
    def focus_element(self, element: Dict) -> bool:
        """Focus element"""
        try:
            selector = element.get('selector')
            if not selector:
                return False
            
            script = f"""
            (function() {{
                const el = document.querySelector('{selector}');
                if (el) {{
                    el.focus();
                    return true;
                }}
                return false;
            }})();
            """
            
            result = self.execute_script(script)
            return result == True
            
        except:
            return False
    
    def highlight_element(self, element: Dict, duration: float = 1.0):
        """Highlight element visually"""
        # Not implemented for CDP
        pass
    
    def capture_screenshot(self, name: str, annotate: bool = False) -> Optional[Path]:
        """Capture screenshot via CDP"""
        try:
            result = self._send_command("Page.captureScreenshot", {
                "format": "png",
                "captureBeyondViewport": False
            })
            
            if 'result' in result and 'data' in result['result']:
                import base64
                
                screenshot_dir = Path("tests/screenshots")
                screenshot_dir.mkdir(parents=True, exist_ok=True)
                
                filepath = screenshot_dir / f"{name}.png"
                
                image_data = base64.b64decode(result['result']['data'])
                filepath.write_bytes(image_data)
                
                return filepath
            
            return None
            
        except Exception as e:
            print(f"   [ERROR] Screenshot failed: {e}")
            return None
    
    def get_window_info(self) -> Dict[str, Any]:
        """Get window information"""
        script = """
        ({
            title: document.title,
            url: window.location.href,
            width: window.innerWidth,
            height: window.innerHeight
        });
        """
        
        info = self.execute_script(script)
        return info or {}
    
    def disconnect(self):
        """Disconnect from CDP"""
        if self.ws:
            self.ws.close()
            self.ws = None
