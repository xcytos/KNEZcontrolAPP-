"""
Test UI CLI Framework with DEEP scanning on knez-control-app
"""

import sys
from pathlib import Path

# Add framework to path
framework_dir = Path(__file__).parent.parent / ".debug-tools" / "ui-automation-framework"
sys.path.insert(0, str(framework_dir))

# Import modules directly
from backends.backend_selector import BackendSelector
from resolvers.ai_resolver import AIElementResolver


def main():
    print("=" * 70)
    print("🧪 Testing UI Automation CLI Framework - DEEP SCAN")
    print("=" * 70)
    
    # Initialize backend
    print("\n🔌 Connecting to knez-control-app...")
    backend = BackendSelector("knez-control-app")
    
    # Try pywinauto connection
    if not backend.try_connect('pywinauto'):
        print("❌ Failed to connect. Is the app running?")
        return False
    
    print("✅ Connected successfully!")
    
    # Get window info
    info = backend.get_window_info()
    print(f"   Window: {info.get('title', 'N/A')}")
    print(f"   Size: {info.get('size', {}).get('width')}x{info.get('size', {}).get('height')}")
    
    # Test DEEP scan
    print("\n🔍 DEEP SCAN: Scanning ALL UI elements (this may take a moment)...")
    elements = backend.get_elements('deep')
    print(f"   Found {len(elements)} total elements\n")
    
    # Group by type
    by_type = {}
    for elem in elements:
        elem_type = elem.get('type', 'unknown')
        if elem_type not in by_type:
            by_type[elem_type] = []
        by_type[elem_type].append(elem)
    
    # Display summary
    print("📊 Element Summary by Type:")
    for elem_type, elem_list in sorted(by_type.items()):
        visible_count = len([e for e in elem_list if e.get('visible')])
        print(f"   {elem_type.upper()}: {len(elem_list)} total ({visible_count} visible)")
    
    # Show first 20 visible elements
    visible_elements = [e for e in elements if e.get('visible')]
    print(f"\n📋 First 20 Visible Elements:")
    for i, elem in enumerate(visible_elements[:20]):
        label = elem.get('label', 'N/A')
        elem_type = elem.get('type', 'N/A')
        text = elem.get('text', '')
        
        display = f"   [{i+1}] {elem_type:8} | {label:30}"
        if text and text != label:
            display += f" | Text: {text[:30]}"
        
        print(display)
    
    if len(visible_elements) > 20:
        print(f"   ... and {len(visible_elements) - 20} more visible elements")
    
    # Test AI Resolver with deep scan
    print("\n🤖 Testing AI Element Resolver with deep scan...")
    resolver = AIElementResolver(backend)
    resolver.update_registry(elements)
    
    # Try various queries
    test_queries = [
        "sessions",
        "session",
        "checkpoints",
        "tab",
        "button"
    ]
    
    print("\n🔍 Testing Natural Language Queries:")
    for query in test_queries:
        print(f"\n   Query: '{query}'")
        resolved = resolver.resolve(query, action='click')
        
        if resolved:
            elem = resolved['element']
            confidence = resolved['confidence']
            match_type = resolved['match_type']
            
            print(f"      ✅ Match: {elem.get('label')} ({elem.get('type')})")
            print(f"      Confidence: {confidence:.0%} | Method: {match_type}")
        else:
            print(f"      ❌ No match found")
            # Show similar
            similar = resolver.find_similar(query, limit=3)
            if similar:
                print(f"      💡 Suggestions:")
                for s in similar:
                    print(f"         - {s.get('label')} ({s.get('type')})")
    
    # Take final screenshot
    print("\n📸 Capturing final screenshot...")
    screenshot_path = backend.capture_screenshot("cli-deep-scan")
    if screenshot_path:
        print(f"   ✅ Saved: {screenshot_path}")
    
    print("\n" + "=" * 70)
    print("✅ DEEP SCAN Test Complete!")
    print("📊 Summary:")
    print(f"   Total Elements: {len(elements)}")
    print(f"   Visible Elements: {len(visible_elements)}")
    print(f"   Element Types: {len(by_type)}")
    print("=" * 70)
    
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
