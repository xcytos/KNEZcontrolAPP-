"""
Backend Selector - Multi-strategy backend management
"""

from typing import Optional, List, Dict, Any
from pathlib import Path
from .pywinauto_bridge import PywinautoBridge
from .cdp_bridge import CDPBridge


class BackendSelector:
    """Manages multiple automation backends with fallback strategy"""
    
    def __init__(self, app_identifier: str):
        self.app_identifier = app_identifier
        self.active_backend = None
        self.backend_type = None
        
        # Available backends
        self.backends = {
            'pywinauto': None,
            'cdp': None,  # NEW: CDP for background automation
            # Future backends:
            # 'ui-labeller': None,  # For web content in Tauri
            # 'vision': None        # Computer vision fallback
        }
    
    def try_connect(self, strategy: str) -> bool:
        """Try connecting with a specific strategy"""
        if strategy == 'pywinauto':
            return self._try_pywinauto()
        elif strategy == 'cdp':
            return self._try_cdp()
        elif strategy == 'ui-labeller':
            # TODO: Implement UI Labeller bridge for web content
            return False
        elif strategy == 'vision':
            # TODO: Implement computer vision backend
            return False
        
        return False
    
    def _try_pywinauto(self) -> bool:
        """Try connecting via pywinauto"""
        try:
            bridge = PywinautoBridge(self.app_identifier)
            if bridge.connect():
                self.backends['pywinauto'] = bridge
                self.active_backend = bridge
                self.backend_type = 'pywinauto'
                return True
        except Exception as e:
            print(f"   [WARN] PyWinAuto connection failed: {e}")
        
        return False
    
    def _try_cdp(self) -> bool:
        """Try connecting via CDP (Chrome DevTools Protocol)"""
        try:
            bridge = CDPBridge(cdp_port=9222)
            if bridge.connect():
                self.backends['cdp'] = bridge
                self.active_backend = bridge
                self.backend_type = 'cdp'
                return True
        except Exception as e:
            print(f"   [WARN] CDP connection failed: {e}")
        
        return False
    
    def is_connected(self) -> bool:
        """Check if any backend is connected"""
        return self.active_backend is not None
    
    def get_backend_type(self) -> Optional[str]:
        """Get active backend type"""
        return self.backend_type
    
    def get_elements(self, mode: str = 'fast') -> List[Dict[str, Any]]:
        """Get UI elements from active backend"""
        if not self.active_backend:
            return []
        
        return self.active_backend.get_elements(mode)
    
    def click_element(self, element: Dict) -> bool:
        """Click element using active backend"""
        if not self.active_backend:
            return False
        
        return self.active_backend.click_element(element)
    
    def hover_element(self, element: Dict) -> bool:
        """Hover over element"""
        if not self.active_backend:
            return False
        
        return self.active_backend.hover_element(element)
    
    def focus_element(self, element: Dict) -> bool:
        """Focus element"""
        if not self.active_backend:
            return False
        
        return self.active_backend.focus_element(element)
    
    def type_text(self, element: Dict, text: str) -> bool:
        """Type text into element"""
        if not self.active_backend:
            return False
        
        return self.active_backend.type_text(element, text)
    
    def highlight_element(self, element: Dict, duration: float = 1.0):
        """Highlight element visually"""
        if not self.active_backend:
            return
        
        self.active_backend.highlight_element(element, duration)
    
    def capture_screenshot(self, name: str, annotate: bool = False) -> Optional[Path]:
        """Capture screenshot"""
        if not self.active_backend:
            return None
        
        return self.active_backend.capture_screenshot(name, annotate)
    
    def get_window_info(self) -> Dict[str, Any]:
        """Get window information"""
        if not self.active_backend:
            return {}
        
        info = self.active_backend.get_window_info()
        info['backend_type'] = self.backend_type
        return info
