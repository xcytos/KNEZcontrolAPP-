#!/usr/bin/env python3
"""
UI Automation CLI - Main Entry Point
Natural language UI automation for Tauri applications

Usage:
    ui-cli connect <app-name>
    ui-check [query]
    ui-click <element>
    ui-hover <element>
    ui-type <element> <text>
    ui-snapshot [name]
    ui-wait <condition> [timeout]
    ui-record start|stop [name]
    ui-replay <recording>
"""

import sys
import json
import time
from pathlib import Path
from typing import Optional, List, Dict, Any

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backends.backend_selector import BackendSelector
from resolvers.ai_resolver import AIElementResolver
from recorder.session_recorder import SessionRecorder


class UIAutomationCLI:
    """Main CLI interface for UI automation"""
    
    def __init__(self):
        self.backend_selector = None
        self.ai_resolver = None
        self.recorder = SessionRecorder()
        self.connected_app = None
        self.element_registry = []
        
    def connect(self, app_identifier: str, taqwin_session: Optional[str] = None):
        """Connect to an application"""
        print(f"🔌 Connecting to: {app_identifier}")
        
        # Initialize backend selector
        self.backend_selector = BackendSelector(app_identifier)
        
        # Try connection strategies in order
        strategies = ['ui-labeller', 'pywinauto', 'vision']
        
        for strategy in strategies:
            print(f"   Trying {strategy}...")
            if self.backend_selector.try_connect(strategy):
                print(f"   ✅ Connected via {strategy}")
                self.connected_app = app_identifier
                
                # Initialize AI resolver with connected backend
                self.ai_resolver = AIElementResolver(self.backend_selector)
                
                # Scan elements
                self.scan_elements()
                
                # Link to TAQWIN session if provided
                if taqwin_session:
                    self.recorder.link_taqwin_session(taqwin_session)
                    print(f"   🔗 Linked to TAQWIN session: {taqwin_session}")
                
                return True
        
        print("   ❌ Could not connect to application")
        return False
    
    def scan_elements(self, mode: str = 'fast'):
        """Scan and index UI elements"""
        print(f"\n🔍 Scanning UI elements ({mode} mode)...")
        
        self.element_registry = self.backend_selector.get_elements(mode)
        
        print(f"   Found {len(self.element_registry)} elements")
        
        # Update AI resolver with new registry
        if self.ai_resolver:
            self.ai_resolver.update_registry(self.element_registry)
    
    def check(self, query: Optional[str] = None):
        """List available UI elements"""
        if not self.connected_app:
            print("❌ Not connected. Use 'ui-cli connect <app>' first")
            return
        
        print(f"\n📋 UI Elements:")
        
        # Filter elements by query if provided
        elements = self.element_registry
        if query:
            elements = [e for e in elements if self._matches_query(e, query)]
            print(f"   Filtering by: '{query}' ({len(elements)} matches)")
        
        # Group by type
        by_type = {}
        for elem in elements:
            elem_type = elem.get('type', 'unknown')
            if elem_type not in by_type:
                by_type[elem_type] = []
            by_type[elem_type].append(elem)
        
        # Display
        for elem_type, elem_list in sorted(by_type.items()):
            print(f"\n   {elem_type.upper()} ({len(elem_list)}):")
            for elem in elem_list[:5]:  # Show first 5 of each type
                label = elem.get('label', elem.get('text', 'N/A'))
                elem_id = elem.get('id', 'N/A')
                visible = '👁️' if elem.get('visible') else '🚫'
                print(f"      {visible} [{elem_id}] {label}")
            
            if len(elem_list) > 5:
                print(f"      ... and {len(elem_list) - 5} more")
        
        print(f"\n   💡 Tip: Use 'ui-click \"<description>\"' to interact")
    
    def click(self, element_query: str):
        """Click on an element"""
        if not self.connected_app:
            print("❌ Not connected. Use 'ui-cli connect <app>' first")
            return
        
        print(f"\n🖱️  Clicking: '{element_query}'")
        
        # Resolve element using AI
        resolved = self.ai_resolver.resolve(element_query, action='click')
        
        if not resolved:
            print("   ❌ Could not find element matching query")
            self._suggest_alternatives(element_query)
            return
        
        # Display what was found
        confidence = resolved.get('confidence', 0)
        elem = resolved['element']
        print(f"   ✅ Resolved to: {elem.get('label', elem.get('id'))}")
        print(f"   📊 Confidence: {confidence:.0%}")
        
        # Confirm if low confidence
        if confidence < 0.85:
            confirm = input("   ⚠️  Low confidence. Proceed? (y/n): ")
            if confirm.lower() != 'y':
                print("   ❌ Aborted")
                return
        
        # Highlight element
        self.backend_selector.highlight_element(elem, duration=0.5)
        
        # Perform click
        success = self.backend_selector.click_element(elem)
        
        if success:
            print("   ✅ Click executed successfully")
            
            # Record action
            self.recorder.log_action('click', elem, element_query)
            
            # Take screenshot
            self._auto_screenshot('after_click')
        else:
            print("   ❌ Click failed")
    
    def hover(self, element_query: str):
        """Hover over an element"""
        if not self.connected_app:
            print("❌ Not connected. Use 'ui-cli connect <app>' first")
            return
        
        print(f"\n👆 Hovering: '{element_query}'")
        
        resolved = self.ai_resolver.resolve(element_query, action='hover')
        
        if not resolved:
            print("   ❌ Could not find element")
            return
        
        elem = resolved['element']
        print(f"   ✅ Hovering over: {elem.get('label', elem.get('id'))}")
        
        # Perform hover
        success = self.backend_selector.hover_element(elem)
        
        if success:
            self.recorder.log_action('hover', elem, element_query)
            time.sleep(2)  # Keep hover for visibility
    
    def type_text(self, element_query: str, text: str):
        """Type text into an element"""
        if not self.connected_app:
            print("❌ Not connected. Use 'ui-cli connect <app>' first")
            return
        
        print(f"\n⌨️  Typing into: '{element_query}'")
        print(f"   Text: \"{text}\"")
        
        resolved = self.ai_resolver.resolve(element_query, action='type')
        
        if not resolved:
            print("   ❌ Could not find element")
            return
        
        elem = resolved['element']
        
        # Focus element first
        self.backend_selector.focus_element(elem)
        time.sleep(0.3)
        
        # Type text
        success = self.backend_selector.type_text(elem, text)
        
        if success:
            print("   ✅ Text entered successfully")
            self.recorder.log_action('type', elem, element_query, {'text': text})
            self._auto_screenshot('after_type')
        else:
            print("   ❌ Type failed")
    
    def snapshot(self, name: Optional[str] = None):
        """Capture annotated screenshot"""
        if not self.connected_app:
            print("❌ Not connected. Use 'ui-cli connect <app>' first")
            return
        
        if not name:
            name = f"snapshot_{int(time.time())}"
        
        print(f"\n📸 Capturing snapshot: {name}")
        
        filepath = self.backend_selector.capture_screenshot(name, annotate=True)
        
        if filepath:
            print(f"   ✅ Saved to: {filepath}")
            self.recorder.log_action('snapshot', None, name, {'filepath': str(filepath)})
        else:
            print("   ❌ Snapshot failed")
    
    def wait(self, condition: str, timeout: int = 5000):
        """Wait for a condition"""
        if not self.connected_app:
            print("❌ Not connected. Use 'ui-cli connect <app>' first")
            return
        
        print(f"\n⏳ Waiting for: '{condition}' (timeout: {timeout}ms)")
        
        start_time = time.time()
        
        while (time.time() - start_time) * 1000 < timeout:
            # Re-scan elements
            self.element_registry = self.backend_selector.get_elements('fast')
            self.ai_resolver.update_registry(self.element_registry)
            
            # Check condition
            if self._check_condition(condition):
                elapsed = (time.time() - start_time) * 1000
                print(f"   ✅ Condition met after {elapsed:.0f}ms")
                return True
            
            time.sleep(0.1)
        
        print(f"   ❌ Timeout reached ({timeout}ms)")
        return False
    
    def record_start(self, name: str):
        """Start recording session"""
        print(f"\n🎬 Recording started: {name}")
        self.recorder.start(name, self.connected_app)
        print("   💡 All actions will be recorded")
        print("   💡 Use 'ui-record stop' to finish")
    
    def record_stop(self):
        """Stop recording session"""
        print(f"\n⏹️  Stopping recording...")
        
        recording_path = self.recorder.stop()
        
        if recording_path:
            print(f"   ✅ Recording saved to: {recording_path}")
            print(f"   🐍 Generated test script: {recording_path.replace('.json', '.py')}")
        else:
            print("   ❌ No active recording")
    
    def replay(self, recording_path: str):
        """Replay a recorded session"""
        print(f"\n▶️  Replaying: {recording_path}")
        
        # Load recording
        with open(recording_path, 'r') as f:
            recording = json.load(f)
        
        # Execute actions
        for action in recording['actions']:
            action_type = action['type']
            element = action['element']
            
            print(f"\n   Action #{action['id']}: {action_type}")
            
            if action_type == 'click':
                self.click(element['label'])
            elif action_type == 'type':
                self.type_text(element['label'], action['text'])
            elif action_type == 'hover':
                self.hover(element['label'])
            
            time.sleep(0.5)  # Pause between actions
        
        print(f"\n   ✅ Replay complete ({len(recording['actions'])} actions)")
    
    # Helper methods
    
    def _matches_query(self, element: Dict, query: str) -> bool:
        """Check if element matches query"""
        query_lower = query.lower()
        
        # Check label
        label = element.get('label', '').lower()
        if query_lower in label:
            return True
        
        # Check type
        elem_type = element.get('type', '').lower()
        if query_lower in elem_type:
            return True
        
        # Check text
        text = element.get('text', '').lower()
        if query_lower in text:
            return True
        
        return False
    
    def _check_condition(self, condition: str) -> bool:
        """Check if a condition is met"""
        # Parse condition
        if ' visible' in condition:
            element_query = condition.replace(' visible', '').strip()
            resolved = self.ai_resolver.resolve(element_query, action='check')
            return resolved and resolved['element'].get('visible', False)
        
        elif ' disappears' in condition:
            element_query = condition.replace(' disappears', '').strip()
            resolved = self.ai_resolver.resolve(element_query, action='check')
            return not resolved or not resolved['element'].get('visible', True)
        
        elif ' exists' in condition:
            element_query = condition.replace(' exists', '').strip()
            resolved = self.ai_resolver.resolve(element_query, action='check')
            return resolved is not None
        
        return False
    
    def _auto_screenshot(self, name: str):
        """Auto-capture screenshot if recording"""
        if self.recorder.is_recording():
            self.backend_selector.capture_screenshot(name, annotate=False)
    
    def _suggest_alternatives(self, query: str):
        """Suggest alternative elements"""
        print("\n   💡 Did you mean:")
        
        # Get top 3 similar elements
        similar = self.ai_resolver.find_similar(query, limit=3)
        
        for elem in similar:
            label = elem.get('label', elem.get('id'))
            print(f"      - {label}")


# CLI Command Router
def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    
    command = sys.argv[1]
    cli = UIAutomationCLI()
    
    # Parse command
    if command == 'connect':
        if len(sys.argv) < 3:
            print("Usage: ui-cli connect <app-name> [--taqwin-session SESSION_ID]")
            return
        
        app_name = sys.argv[2]
        taqwin_session = None
        
        if '--taqwin-session' in sys.argv:
            idx = sys.argv.index('--taqwin-session')
            if idx + 1 < len(sys.argv):
                taqwin_session = sys.argv[idx + 1]
        
        cli.connect(app_name, taqwin_session)
    
    elif command == 'check':
        query = ' '.join(sys.argv[2:]) if len(sys.argv) > 2 else None
        cli.check(query)
    
    elif command == 'click':
        if len(sys.argv) < 3:
            print("Usage: ui-cli click <element>")
            return
        element_query = ' '.join(sys.argv[2:])
        cli.click(element_query)
    
    elif command == 'hover':
        if len(sys.argv) < 3:
            print("Usage: ui-cli hover <element>")
            return
        element_query = ' '.join(sys.argv[2:])
        cli.hover(element_query)
    
    elif command == 'type':
        if len(sys.argv) < 4:
            print("Usage: ui-cli type <element> <text>")
            return
        element_query = sys.argv[2]
        text = ' '.join(sys.argv[3:])
        cli.type_text(element_query, text)
    
    elif command == 'snapshot':
        name = sys.argv[2] if len(sys.argv) > 2 else None
        cli.snapshot(name)
    
    elif command == 'wait':
        if len(sys.argv) < 3:
            print("Usage: ui-cli wait <condition> [timeout]")
            return
        condition = ' '.join(sys.argv[2:-1] if len(sys.argv) > 3 else sys.argv[2:])
        timeout = int(sys.argv[-1]) if len(sys.argv) > 3 and sys.argv[-1].isdigit() else 5000
        cli.wait(condition, timeout)
    
    elif command == 'record':
        if len(sys.argv) < 3:
            print("Usage: ui-cli record start|stop [name]")
            return
        
        subcommand = sys.argv[2]
        if subcommand == 'start':
            name = sys.argv[3] if len(sys.argv) > 3 else f"recording_{int(time.time())}"
            cli.record_start(name)
        elif subcommand == 'stop':
            cli.record_stop()
    
    elif command == 'replay':
        if len(sys.argv) < 3:
            print("Usage: ui-cli replay <recording-path>")
            return
        cli.replay(sys.argv[2])
    
    else:
        print(f"Unknown command: {command}")
        print(__doc__)


if __name__ == '__main__':
    main()
