"""
Live UI Testing for knez-control-app
Uses pywinauto to interact with the running Tauri application
"""

from pywinauto import Application, Desktop
from pywinauto.keyboard import send_keys
import time
import os

def find_knez_window():
    """Find the knez-control-app window"""
    desktop = Desktop(backend="uia")
    
    # Try to find exact match first
    try:
        window = desktop.window(title="knez-control-app")
        if window.exists():
            print(f"✅ Found window: knez-control-app")
            return window
    except Exception as e:
        pass
    
    # Try with regex patterns
    possible_patterns = [
        "knez-control-app",
        "knez_control_app",
        "KNEZ.*",
        ".*knez.*"
    ]
    
    for pattern in possible_patterns:
        try:
            window = desktop.window(title_re=pattern)
            if window.exists():
                print(f"✅ Found window matching: {pattern}")
                print(f"   Window title: {window.window_text()}")
                return window
        except Exception as e:
            continue
    
    # List all windows if not found
    print("\n🔍 Available windows:")
    for window in desktop.windows():
        try:
            title = window.window_text()
            if title:
                print(f"  - {title}")
        except:
            pass
    
    return None

def test_ui_navigation():
    """Test UI navigation in the Tauri app"""
    print("🚀 Starting Live UI Test for knez-control-app\n")
    
    # Find the Tauri window
    window = find_knez_window()
    
    if not window:
        print("❌ Could not find knez-control-app window")
        print("   Make sure the app is running!")
        return False
    
    try:
        # Bring window to foreground
        window.set_focus()
        time.sleep(1)
        
        print("\n📸 Taking screenshot...")
        window.capture_as_image().save("tests/screenshots/initial-state.png")
        print("   Saved: tests/screenshots/initial-state.png")
        
        # Get all controls
        print("\n🔍 Discovering UI elements...")
        window.print_control_identifiers()
        
        # Try to find and click tabs/buttons
        print("\n🖱️ Attempting to interact with UI...")
        
        # Look for common elements
        try:
            # Try to find sessions tab
            sessions_button = window.child_window(title_re=".*[Ss]essions.*", control_type="Button")
            if sessions_button.exists():
                print("   Found 'Sessions' button - clicking...")
                sessions_button.click()
                time.sleep(1)
                window.capture_as_image().save("tests/screenshots/sessions-tab.png")
                print("   ✅ Clicked Sessions tab")
        except Exception as e:
            print(f"   ⚠️  Sessions button not found: {e}")
        
        try:
            # Try to find checkpoints tab
            checkpoints_button = window.child_window(title_re=".*[Cc]heckpoint.*", control_type="Button")
            if checkpoints_button.exists():
                print("   Found 'Checkpoints' button - clicking...")
                checkpoints_button.click()
                time.sleep(1)
                window.capture_as_image().save("tests/screenshots/checkpoints-tab.png")
                print("   ✅ Clicked Checkpoints tab")
        except Exception as e:
            print(f"   ⚠️  Checkpoints button not found: {e}")
        
        # Try to find any text input
        try:
            text_inputs = window.descendants(control_type="Edit")
            if text_inputs:
                print(f"\n   Found {len(text_inputs)} text input(s)")
                first_input = text_inputs[0]
                print("   Typing test text...")
                first_input.set_focus()
                send_keys("Test automation text", with_spaces=True)
                time.sleep(1)
                window.capture_as_image().save("tests/screenshots/text-input.png")
                print("   ✅ Typed text successfully")
        except Exception as e:
            print(f"   ⚠️  Text input interaction failed: {e}")
        
        print("\n✅ UI Test Complete!")
        print("📂 Screenshots saved in: tests/screenshots/")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        return False

def test_keyboard_navigation():
    """Test keyboard shortcuts in the app"""
    print("\n⌨️  Testing Keyboard Navigation...")
    
    window = find_knez_window()
    if not window:
        return False
    
    try:
        window.set_focus()
        
        # Try Tab key navigation
        print("   Testing Tab navigation...")
        send_keys("{TAB}")
        time.sleep(0.5)
        send_keys("{TAB}")
        time.sleep(0.5)
        
        # Try Ctrl+S (save shortcut if exists)
        print("   Testing Ctrl+S...")
        send_keys("^s")  # Ctrl+S
        time.sleep(0.5)
        
        print("   ✅ Keyboard navigation test complete")
        return True
        
    except Exception as e:
        print(f"   ❌ Keyboard test failed: {e}")
        return False

def get_window_info():
    """Get detailed information about the Tauri window"""
    print("\n📊 Window Information:")
    
    window = find_knez_window()
    if not window:
        return
    
    try:
        rect = window.rectangle()
        print(f"   Position: ({rect.left}, {rect.top})")
        print(f"   Size: {rect.width()}x{rect.height()}")
        print(f"   Visible: {window.is_visible()}")
        print(f"   Enabled: {window.is_enabled()}")
        print(f"   Title: {window.window_text()}")
        
    except Exception as e:
        print(f"   ❌ Could not get window info: {e}")

if __name__ == "__main__":
    # Create screenshots directory
    os.makedirs("tests/screenshots", exist_ok=True)
    
    print("=" * 60)
    print("🧪 KNEZ Control App - Live UI Testing")
    print("=" * 60)
    
    # Run tests
    get_window_info()
    test_ui_navigation()
    test_keyboard_navigation()
    
    print("\n" + "=" * 60)
    print("🏁 Testing Complete")
    print("=" * 60)
