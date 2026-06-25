"""
Session Recorder - Record and replay UI automation sessions
"""

import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any


class SessionRecorder:
    """Record UI automation actions for replay"""
    
    def __init__(self):
        self.recording = False
        self.recording_name = None
        self.recording_data = {}
        self.actions = []
        self.taqwin_session_id = None
    
    def link_taqwin_session(self, session_id: str):
        """Link recorder to TAQWIN session"""
        self.taqwin_session_id = session_id
    
    def start(self, name: str, app_identifier: str):
        """Start recording session"""
        self.recording = True
        self.recording_name = name
        self.actions = []
        
        self.recording_data = {
            'name': name,
            'app': app_identifier,
            'started_at': datetime.now().isoformat(),
            'taqwin_session': self.taqwin_session_id,
            'actions': []
        }
    
    def stop(self) -> Optional[Path]:
        """Stop recording and save"""
        if not self.recording:
            return None
        
        self.recording = False
        self.recording_data['ended_at'] = datetime.now().isoformat()
        self.recording_data['actions'] = self.actions
        
        # Save recording
        recording_dir = Path("tests/recordings")
        recording_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.recording_name}_{timestamp}.json"
        filepath = recording_dir / filename
        
        with open(filepath, 'w') as f:
            json.dump(self.recording_data, f, indent=2)
        
        # Generate Python test script
        self._generate_test_script(filepath)
        
        return filepath
    
    def log_action(self, action_type: str, element: Optional[Dict], 
                   query: str, metadata: Optional[Dict] = None):
        """Log an action"""
        if not self.recording:
            return
        
        action = {
            'id': len(self.actions) + 1,
            'type': action_type,
            'timestamp': time.time(),
            'query': query,
            'element': {
                'label': element.get('label', 'N/A') if element else 'N/A',
                'type': element.get('type', 'N/A') if element else 'N/A',
                'id': element.get('id', 'N/A') if element else 'N/A',
            } if element else None
        }
        
        if metadata:
            action['metadata'] = metadata
        
        self.actions.append(action)
    
    def is_recording(self) -> bool:
        """Check if currently recording"""
        return self.recording
    
    def _generate_test_script(self, recording_filepath: Path):
        """Generate Python test script from recording"""
        script_filepath = recording_filepath.with_suffix('.py')
        
        script_lines = [
            '"""',
            f'Generated test script from recording: {self.recording_name}',
            f'Created: {datetime.now().isoformat()}',
            '"""',
            '',
            'import sys',
            'from pathlib import Path',
            '',
            '# Add framework to path',
            'framework_dir = Path(__file__).parent.parent.parent / ".debug-tools" / "ui-automation-framework"',
            'sys.path.insert(0, str(framework_dir))',
            '',
            'from cli.ui_cli import UIAutomationCLI',
            '',
            '',
            'def test_recorded_session():',
            '    """Replay recorded session"""',
            '    cli = UIAutomationCLI()',
            '    ',
            f'    # Connect to app',
            f'    cli.connect("{self.recording_data["app"]}")',
            '    ',
        ]
        
        for action in self.actions:
            action_type = action['type']
            query = action['query']
            
            if action_type == 'click':
                script_lines.append(f'    cli.click("{query}")')
            elif action_type == 'hover':
                script_lines.append(f'    cli.hover("{query}")')
            elif action_type == 'type':
                text = action.get('metadata', {}).get('text', '')
                script_lines.append(f'    cli.type_text("{query}", "{text}")')
            elif action_type == 'snapshot':
                script_lines.append(f'    cli.snapshot("{query}")')
            
            script_lines.append('    ')
        
        script_lines.extend([
            '    print("✅ Test replay complete")',
            '',
            '',
            'if __name__ == "__main__":',
            '    test_recorded_session()',
            ''
        ])
        
        with open(script_filepath, 'w') as f:
            f.write('\n'.join(script_lines))
