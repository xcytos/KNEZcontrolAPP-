/**
 * Inject Loader for Next.js Dev Server
 * Automatically injects UI Labeller into running application
 */

const fs = require('fs');
const path = require('path');

const INJECTOR_PATH = path.join(__dirname, 'injector.js');
const TARGET_HTML = '_document.tsx';

function injectIntoHTML(htmlContent) {
  const injectorScript = fs.readFileSync(INJECTOR_PATH, 'utf-8');
  
  const scriptTag = `
    <script>
      // UI Labeller Debug Tool
      ${injectorScript}
    </script>
  `;

  // Inject before closing body tag
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', `${scriptTag}</body>`);
  }

  // Inject before closing html tag
  if (htmlContent.includes('</html>')) {
    return htmlContent.replace('</html>', `${scriptTag}</html>`);
  }

  // Append at end
  return htmlContent + scriptTag;
}

function injectIntoDevServer() {
  console.log('[UI Labeller] Injecting into dev server...');
  
  // For Next.js, we'll inject via middleware
  const middlewarePath = path.join(process.cwd(), 'middleware.ts');
  
  if (!fs.existsSync(middlewarePath)) {
    console.log('[UI Labeller] Creating middleware for injection...');
    
    const middlewareContent = `
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // UI Labeller injection handled by client-side script
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
`;
    
    fs.writeFileSync(middlewarePath, middlewareContent);
  }

  // Create public script file for injection
  const publicDir = path.join(process.cwd(), 'public');
  const debugDir = path.join(publicDir, '.debug-tools');
  
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }

  const publicScriptPath = path.join(debugDir, 'ui-labeller.js');
  const injectorContent = fs.readFileSync(INJECTOR_PATH, 'utf-8');
  
  fs.writeFileSync(publicScriptPath, injectorContent);
  
  console.log('[UI Labeller] ✓ Injector script created at /public/.debug-tools/ui-labeller.js');
  console.log('[UI Labeller] Add this to your _app.tsx or layout.tsx:');
  console.log('');
  console.log('  <Script src="/.debug-tools/ui-labeller.js" strategy="afterInteractive" />');
  console.log('');
}

// Run injection
if (require.main === module) {
  injectIntoDevServer();
}

module.exports = { injectIntoHTML, injectIntoDevServer };
