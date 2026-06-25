"""Quick CDP connection test"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from backends.cdp_bridge import CDPBridge

print("Testing CDP connection...")
bridge = CDPBridge()
result = bridge.connect()
print(f"CDP Connect: {result}")

if result:
    elements = bridge.get_elements()
    print(f"Elements found: {len(elements)}")
    
    # Show first 5 elements
    print("\nFirst 5 elements:")
    for elem in elements[:5]:
        print(f"  - {elem.get('label')} ({elem.get('type')})")
else:
    print("Connection failed - check if app is running with CDP flags")
