// Test script to verify shell plugin fix
const { Command } = require('@tauri-apps/plugin-shell');

async function testShellCommand() {
  console.log('Testing shell command fix...');
  
  try {
    // Test the old way (should fail with shell plugin error)
    console.log('Testing old powershell command...');
    const oldCommand = Command.create("powershell", [
      "-ExecutionPolicy", "Bypass",
      "-File", "scripts/start_ollama.ps1"
    ]);
    
    oldCommand.on("error", (error) => {
      console.log('Old command error (expected):', error);
    });
    
    // Test the new way (should work)
    console.log('Testing new cmd command...');
    const newCommand = Command.create("cmd", [
      "/c", "powershell", "-ExecutionPolicy", "Bypass", "-File", "scripts/start_ollama.ps1"
    ]);
    
    newCommand.on("error", (error) => {
      console.log('New command error:', error);
    });
    
    newCommand.stdout.on("data", (line) => {
      console.log('Output:', line);
    });
    
    console.log('Commands created successfully');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
}

testShellCommand().then(success => {
  console.log('Test result:', success ? 'SUCCESS' : 'FAILED');
});
