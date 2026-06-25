"""
Test UI CLI Framework on running knez-control-app
"""

import sys
from pathlib import Path

# Add framework to path
framework_dir = Path(__file__).parent.parent / ".debug-tools" / "ui-automation-framework"
sys.path.insert(0, str(framework_dir))

# Import modules directly
from backends.backend_selector import BackendSelector
from resolvers.ai_resolver import AIElementResolver
from recorder.session_recorder import SessionRecorder


def main():
    print("=" * 70)
    print("🧪 Testing UI Automation CLI Framework")
    print("=" * 70)
    
    # Initialize backend
    print("\n🔌 Test 1: Connecting to knez-control-app...")
    backend = BackendSelector("knez-control-app")
    
    # Try pywinauto connection
    if not backend.try_connect('pywinauto'):
        print("❌ Failed to connect. Is the app running?")
        return False
    
    print("✅ Connected successfully!")
    print(f"   Backend: {backend.get_backend_type()}")
    
    # Get window info
    info = backend.get_window_info()
    print(f"   Window: {info.get('title', 'N/A')}")
    print(f"   Size: {info.get('size', {}).get('width')}x{info.get('size', {}).get('height')}")
    
    # Test 2: Scan elements
    print("\n📋 Test 2: Scanning UI elements...")
    elements = backend.get_elements('fast')
    print(f"   Found {len(elements)} elements")
    
    # Show first 10 elements
    for i, elem in enumerate(elements[:10]):
        visible = '👁️' if elem.get('visible') else '🚫'
        label = elem.get('label', 'N/A')
        elem_type = elem.get('type', 'N/A')
        print(f"      {visible} [{elem_type}] {label}")
    
    # Test 3: Initialize AI Resolver
    print("\n🤖 Test 3: Initializing AI Element Resolver...")
    resolver = AIElementResolver(backend)
    resolver.update_registry(elements)
    print("   ✅ AI Resolver ready")
    
    # Test 4: Take snapshot
    print("\n📸 Test 4: Capturing screenshot...")
    screenshot_path = backend.capture_screenshot("cli-test-initial")
    if screenshot_path:
        print(f"   ✅ Saved: {screenshot_path}")
    
    # Test 5: Try resolving "sessions" element
    print("\n🔍 Test 5: Resolving 'sessions' element...")
    resolved = resolver.resolve("sessions", action='click')
    
    if resolved:
        elem = resolved['element']
        confidence = resolved['confidence']
        match_type = resolved['match_type']
        
        print(f"   ✅ Resolved:")
        print(f"      Label: {elem.get('label')}")
        print(f"      Type: {elem.get('type')}")
        print(f"      Confidence: {confidence:.0%}")
        print(f"      Match Type: {match_type}")
        
        # Test 6: Click the element
        print("\n🖱️  Test 6: Clicking resolved element...")
        if backend.click_element(elem):
            print("   ✅ Click successful!")
            
            # Wait for UI update
            import time
            time.sleep(0.5)
            
            # Take another screenshot
            screenshot_path = backend.capture_screenshot("cli-test-after-click")
            if screenshot_path:
                print(f"   📸 Post-click screenshot: {screenshot_path}")
        else:
            print("   ❌ Click failed")
    else:
        print("   ⚠️  Could not resolve 'sessions' element")
        print("   Available elements:")
        similar = resolver.find_similar("sessions", limit=5)
        for elem in similar:
            print(f"      - {elem.get('label')} ({elem.get('type')})")
    
    print("\n" + "=" * 70)
    print("✅ UI CLI Framework Test Complete!")
    print("=" * 70)
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
