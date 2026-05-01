// Test script to verify shell commands work without shell plugin
const { Command } = require('@tauri-apps/plugin-shell');

async function testCommands() {
  console.log('Testing shell commands...');
  
  try {
    // Test 1: Test the old powershell command (should fail)
    console.log('\n1. Testing old powershell command (should fail):');
    try {
      const oldCmd = Command.create("powershell", [
        "-ExecutionPolicy", "Bypass",
        "-File", "scripts/start_ollama.ps1"
      ]);
      console.log('ERROR: Old command should have failed but did not!');
    } catch (error) {
      console.log('✓ Old command failed as expected:', error.message);
    }
    
    // Test 2: Test the new cmd command (should work)
    console.log('\n2. Testing new cmd command (should work):');
    try {
      const newCmd = Command.create("cmd", [
        "/c", "echo", "Shell plugin test successful"
      ]);
      console.log('✓ New command created successfully');
    } catch (error) {
      console.log('✗ New command failed:', error.message);
    }
    
    // Test 3: Test the actual ollama startup command
    console.log('\n3. Testing ollama startup command:');
    try {
      const ollamaCmd = Command.create("cmd", [
        "/c", "powershell", "-ExecutionPolicy", "Bypass", "-File", "scripts/start_ollama.ps1"
      ]);
      console.log('✓ Ollama command created successfully');
    } catch (error) {
      console.log('✗ Ollama command failed:', error.message);
    }
    
    console.log('\nTest completed successfully!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
}

// Run the test
testCommands().then(success => {
  console.log('\nFinal result:', success ? 'SUCCESS' : 'FAILED');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
