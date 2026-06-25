"""
Live UI Actions Test - Click elements and log to TAQWIN
"""

import sys
from pathlib import Path
import time

# Add framework to path
framework_dir = Path(__file__).parent.parent / ".debug-tools" / "ui-automation-framework"
sys.path.insert(0, str(framework_dir))

# Import modules
from backends.backend_selector import BackendSelector
from resolvers.ai_resolver import AIElementResolver


def main():
    print("=" * 70)
    print("🧪 Live UI Actions Test - knez-control-app")
    print("=" * 70)
    
    # Connect to app
    print("\n🔌 Connecting to knez-control-app...")
    backend = BackendSelector("knez-control-app")
    
    if not backend.try_connect('pywinauto'):
        print("❌ Failed to connect. Is the app running?")
        return False
    
    print("✅ Connected successfully!")
    
    # Deep scan
    print("\n🔍 Scanning UI elements...")
    elements = backend.get_elements('deep')
    print(f"   Found {len(elements)} elements")
    
    # Initialize resolver
    resolver = AIElementResolver(backend)
    resolver.update_registry(elements)
    print("   ✅ AI Resolver ready\n")
    
    # Capture initial state
    print("📸 Capturing initial state...")
    backend.capture_screenshot("live-test-initial")
    print("   ✅ Saved screenshot\n")
    
    # Test scenarios
    actions_performed = []
    
    # ACTION 1: Click "Sessions" or "Active Sessions"
    print("=" * 70)
    print("🖱️  ACTION 1: Click Sessions")
    print("=" * 70)
    
    resolved = resolver.resolve("sessions", action='click')
    if resolved:
        elem = resolved['element']
        print(f"   Resolved: {elem.get('label')} ({resolved['confidence']:.0%} confidence)")
        print(f"   Type: {elem.get('type')} | Visible: {elem.get('visible')}")
        
        print("   Clicking...")
        if backend.click_element(elem):
            print("   ✅ Click successful!")
            actions_performed.append({
                'action': 'click',
                'target': elem.get('label'),
                'query': 'sessions'
            })
            
            time.sleep(1)
            backend.capture_screenshot("live-test-after-sessions-click")
            print("   📸 Screenshot captured\n")
        else:
            print("   ❌ Click failed\n")
    else:
        print("   ❌ Could not resolve 'sessions'\n")
    
    # ACTION 2: Click "Checkpoints"
    print("=" * 70)
    print("🖱️  ACTION 2: Click Checkpoints")
    print("=" * 70)
    
    resolved = resolver.resolve("checkpoints", action='click')
    if resolved:
        elem = resolved['element']
        print(f"   Resolved: {elem.get('label')} ({resolved['confidence']:.0%} confidence)")
        print(f"   Type: {elem.get('type')} | Visible: {elem.get('visible')}")
        
        print("   Clicking...")
        if backend.click_element(elem):
            print("   ✅ Click successful!")
            actions_performed.append({
                'action': 'click',
                'target': elem.get('label'),
                'query': 'checkpoints'
            })
            
            time.sleep(1)
            backend.capture_screenshot("live-test-after-checkpoints-click")
            print("   📸 Screenshot captured\n")
        else:
            print("   ❌ Click failed\n")
    else:
        print("   ❌ Could not resolve 'checkpoints'\n")
    
    # ACTION 3: Click "Dashboard" menu
    print("=" * 70)
    print("🖱️  ACTION 3: Click Dashboard")
    print("=" * 70)
    
    resolved = resolver.resolve("dashboard", action='click')
    if resolved:
        elem = resolved['element']
        print(f"   Resolved: {elem.get('label')} ({resolved['confidence']:.0%} confidence)")
        print(f"   Type: {elem.get('type')} | Visible: {elem.get('visible')}")
        
        print("   Clicking...")
        if backend.click_element(elem):
            print("   ✅ Click successful!")
            actions_performed.append({
                'action': 'click',
                'target': elem.get('label'),
                'query': 'dashboard'
            })
            
            time.sleep(1)
            backend.capture_screenshot("live-test-after-dashboard-click")
            print("   📸 Screenshot captured\n")
        else:
            print("   ❌ Click failed\n")
    else:
        print("   ❌ Could not resolve 'dashboard'\n")
    
    # Summary
    print("=" * 70)
    print("✅ Live UI Actions Test Complete!")
    print("=" * 70)
    print(f"\n📊 Summary:")
    print(f"   Total Actions Attempted: 3")
    print(f"   Successful Actions: {len(actions_performed)}")
    print(f"\n📋 Actions Performed:")
    for i, action in enumerate(actions_performed, 1):
        print(f"   {i}. {action['action'].upper()} '{action['target']}' (query: '{action['query']}')")
    
    print(f"\n📸 Screenshots saved in: tests/screenshots/")
    print(f"\n💡 Next: Log these actions to TAQWIN session RA003")
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
