#!/usr/bin/env node

/**
 * UI Labeller Installation Script
 * Sets up the debug tool in your Next.js application
 */

const fs = require('fs');
const path = require('path');

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UI COMPONENT LABELLER - INSTALLATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

const ROOT_DIR = path.join(__dirname, '../..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DEBUG_TOOLS_DIR = path.join(PUBLIC_DIR, '.debug-tools');

// Step 1: Create public debug directory
console.log('[1/4] Creating public debug directory...');
if (!fs.existsSync(DEBUG_TOOLS_DIR)) {
  fs.mkdirSync(DEBUG_TOOLS_DIR, { recursive: true });
  console.log('  ✓ Created /public/.debug-tools/');
} else {
  console.log('  ✓ Directory already exists');
}

// Step 2: Copy injector script
console.log('\n[2/4] Copying injector script...');
const injectorSource = path.join(__dirname, 'injector.js');
const injectorDest = path.join(DEBUG_TOOLS_DIR, 'ui-labeller.js');

fs.copyFileSync(injectorSource, injectorDest);
console.log('  ✓ Copied to /public/.debug-tools/ui-labeller.js');

// Step 3: Copy config
console.log('\n[3/4] Copying configuration...');
const configSource = path.join(__dirname, 'config.json');
const configDest = path.join(DEBUG_TOOLS_DIR, 'config.json');

fs.copyFileSync(configSource, configDest);
console.log('  ✓ Copied to /public/.debug-tools/config.json');

// Step 4: Update layout or _app file
console.log('\n[4/4] Updating application layout...');

const layoutPaths = [
  path.join(ROOT_DIR, 'app', 'layout.tsx'),
  path.join(ROOT_DIR, 'pages', '_app.tsx')
];

let layoutFound = false;

for (const layoutPath of layoutPaths) {
  if (fs.existsSync(layoutPath)) {
    const content = fs.readFileSync(layoutPath, 'utf-8');
    
    // Check if already injected
    if (content.includes('ui-labeller.js')) {
      console.log(`  ✓ UI Labeller already injected in ${path.basename(layoutPath)}`);
      layoutFound = true;
      break;
    }

    // Inject script tag
    const scriptInjection = `
      {/* UI Component Labeller - Debug Tool */}
      {process.env.NODE_ENV === 'development' && (
        <script src="/.debug-tools/ui-labeller.js" async />
      )}`;

    let newContent;

    if (layoutPath.includes('layout.tsx')) {
      // Next.js 13+ App Router
      newContent = content.replace(
        /(<body[^>]*>)/,
        `$1\n${scriptInjection}`
      );
    } else {
      // Pages Router
      newContent = content.replace(
        /(<Component\s+{\.\.\.pageProps}\s*\/>)/,
        `$1\n${scriptInjection}`
      );
    }

    if (newContent !== content) {
      fs.writeFileSync(layoutPath, newContent);
      console.log(`  ✓ Injected into ${path.basename(layoutPath)}`);
      layoutFound = true;
      break;
    }
  }
}

if (!layoutFound) {
  console.log('  ⚠ Could not auto-inject. Manual setup required:');
  console.log('');
  console.log('  Add this to your app/layout.tsx or pages/_app.tsx:');
  console.log('');
  console.log('  {process.env.NODE_ENV === \'development\' && (');
  console.log('    <script src="/.debug-tools/ui-labeller.js" async />');
  console.log('  )}');
  console.log('');
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INSTALLATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next steps:
1. Restart your dev server: npm run dev
2. Open your application in the browser
3. Press Ctrl+Shift+D to toggle component labels

Console commands:
  window.uiLabeller.toggle()  - Toggle overlay
  window.uiLabeller.export()  - Export component data

Configuration:
  Edit .debug-tools/ui-labeller/config.json to customize

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
