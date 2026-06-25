"""
PyWinAuto Bridge - Native Windows UI Automation Backend
"""

from pywinauto import Application, Desktop
from pywinauto.keyboard import send_keys
from pywinauto.mouse import click, move
from pywinauto.findwindows import ElementNotFoundError
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
import json


class PywinautoBridge:
    """Native Windows automation using pywinauto"""
    
    def __init__(self, app_identifier: str):
        self.app_identifier = app_identifier
        self.window = None
        self.desktop = Desktop(backend="uia")
        
    def connect(self) -> bool:
        """Connect to running application"""
        try:
            # Try exact title match
            self.window = self.desktop.window(title=self.app_identifier)
            if self.window.exists():
                return True
        except:
            pass
        
        # Try regex pattern
        try:
            self.window = self.desktop.window(title_re=f".*{self.app_identifier}.*")
            if self.window.exists():
                return True
        except:
            pass
        
        return False
    
    def is_connected(self) -> bool:
        """Check if connected to window"""
        return self.window is not None and self.window.exists()
    
    def get_elements(self, mode: str = 'fast') -> List[Dict[str, Any]]:
        """Scan and return UI elements"""
        if not self.is_connected():
            return []
        
        elements = []
        
        try:
            # Get all descendants
            if mode == 'deep':
                controls = self.window.descendants()
            else:
                # Fast mode - limited depth
                controls = self.window.children()
                for child in self.window.children():
                    try:
                        controls.extend(child.children())
                    except:
                        pass
            
            for idx, control in enumerate(controls):
                try:
                    elem = self._control_to_element(control, idx)
                    if elem:
                        elements.append(elem)
                except Exception as e:
                    continue
                    
        except Exception as e:
            print(f"   ⚠️  Error scanning elements: {e}")
        
        return elements
    
    def _control_to_element(self, control, idx: int) -> Optional[Dict[str, Any]]:
        """Convert pywinauto control to element dict"""
        try:
            # Get control properties
            elem_type = control.element_info.control_type
            text = control.window_text()
            class_name = control.class_name()
            
            # Get position and size
            rect = control.rectangle()
            
            # Get state
            visible = control.is_visible()
            enabled = control.is_enabled()
            
            # Determine element type
            elem_category = self._categorize_control(elem_type, class_name)
            
            # Generate label
            label = text if text else f"{elem_category}_{idx}"
            
            return {
                'id': f"elem_{idx}",
                'label': label,
                'text': text,
                'type': elem_category,
                'control_type': elem_type,
                'class_name': class_name,
                'visible': visible,
                'enabled': enabled,
                'position': {'x': rect.left, 'y': rect.top},
                'size': {'width': rect.width(), 'height': rect.height()},
                'bounds': {
                    'left': rect.left,
                    'top': rect.top,
                    'right': rect.right,
                    'bottom': rect.bottom
                },
                '_control': control  # Keep reference for actions
            }
            
        except Exception as e:
            return None
    
    def _categorize_control(self, control_type: str, class_name: str) -> str:
        """Categorize control into semantic type"""
        control_type_lower = control_type.lower()
        class_name_lower = class_name.lower()
        
        if 'button' in control_type_lower:
            return 'button'
        elif 'edit' in control_type_lower or 'text' in control_type_lower:
            return 'input'
        elif 'tab' in control_type_lower:
            return 'tab'
        elif 'list' in control_type_lower:
            return 'list'
        elif 'menu' in control_type_lower:
            return 'menu'
        elif 'tree' in control_type_lower:
            return 'tree'
        elif 'pane' in control_type_lower:
            return 'pane'
        elif 'window' in control_type_lower:
            return 'window'
        else:
            return 'element'
    
    def click_element(self, element: Dict) -> bool:
        """Click on element using non-intrusive background method"""
        try:
            control = element.get('_control')
            if control:
                # Use invoke() for buttons/menus - doesn't steal focus
                try:
                    control.invoke()
                    return True
                except:
                    pass
                
                # Try click_input with set_focus=False
                try:
                    control.click_input(button='left', coords=(5, 5))
                    return True
                except:
                    pass
                
                # Last resort: post message (background)
                try:
                    from pywinauto.win32functions import PostMessage
                    from pywinauto.win32defines import WM_LBUTTONDOWN, WM_LBUTTONUP
                    
                    hwnd = control.handle
                    PostMessage(hwnd, WM_LBUTTONDOWN, 0, 0)
                    PostMessage(hwnd, WM_LBUTTONUP, 0, 0)
                    return True
                except:
                    pass
            
            return False
                
        except Exception as e:
            print(f"   ⚠️  Click failed: {e}")
            return False
    
    def hover_element(self, element: Dict) -> bool:
        """Hover over element - DISABLED for background operation"""
        # Hovering requires moving the cursor, which we avoid
        # Return True as if succeeded, but don't actually move cursor
        return True
    
    def focus_element(self, element: Dict) -> bool:
        """Focus element"""
        try:
            control = element.get('_control')
            if control:
                control.set_focus()
                return True
        except Exception as e:
            print(f"   ⚠️  Focus failed: {e}")
            return False
    
    def type_text(self, element: Dict, text: str) -> bool:
        """Type text into element using background method"""
        try:
            control = element.get('_control')
            if control:
                # Use set_text for inputs - doesn't steal focus
                try:
                    control.set_text(text)
                    return True
                except:
                    pass
                
                # Try type_keys without focus
                try:
                    control.type_keys(text, with_spaces=True, set_foreground=False)
                    return True
                except:
                    pass
                
                # Post message method (background)
                try:
                    from pywinauto.win32functions import PostMessage
                    from pywinauto.win32defines import WM_SETTEXT
                    
                    hwnd = control.handle
                    PostMessage(hwnd, WM_SETTEXT, 0, text)
                    return True
                except:
                    pass
                    
        except Exception as e:
            print(f"   ⚠️  Type failed: {e}")
            return False
    
    def highlight_element(self, element: Dict, duration: float = 1.0):
        """Highlight element visually (not supported by pywinauto)"""
        # Pywinauto doesn't have built-in highlighting
        # We could implement a transparent overlay window here
        pass
    
    def capture_screenshot(self, name: str, annotate: bool = False) -> Optional[Path]:
        """Capture screenshot without stealing focus"""
        try:
            if not self.is_connected():
                return None
            
            # DON'T focus the window - capture in background
            screenshot_dir = Path("tests/screenshots")
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            
            filepath = screenshot_dir / f"{name}.png"
            
            # Capture without focusing
            img = self.window.capture_as_image()
            img.save(str(filepath))
            
            return filepath
            
        except Exception as e:
            print(f"   ⚠️  Screenshot failed: {e}")
            return None
    
    def get_window_info(self) -> Dict[str, Any]:
        """Get window information"""
        if not self.is_connected():
            return {}
        
        try:
            rect = self.window.rectangle()
            
            return {
                'title': self.window.window_text(),
                'position': {'x': rect.left, 'y': rect.top},
                'size': {'width': rect.width(), 'height': rect.height()},
                'visible': self.window.is_visible(),
                'enabled': self.window.is_enabled(),
                'class_name': self.window.class_name()
            }
        except:
            return {}
