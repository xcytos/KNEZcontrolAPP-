# UI Labeller v5.0 - Installation Guide

A **plug-and-play** DevTools-style React component inspector. Works with Next.js, Tauri, Vite, CRA, and any React application!

---

## ✅ Installation Methods

### Method 1: Next.js (Recommended)

#### Step 1: Copy Files
```bash
# Copy the entire ui-labeller folder to your project
cp -r .debug-tools/ui-labeller /path/to/your/nextjs-project/.debug-tools/
```

#### Step 2: Deploy to Public
```bash
# Windows
cd .debug-tools/ui-labeller
.\deploy.bat

# Mac/Linux
cd .debug-tools/ui-labeller
chmod +x deploy.sh
./deploy.sh
```

Or manually:
```bash
mkdir -p public/.debug-tools
cp .debug-tools/ui-labeller/injector.js public/.debug-tools/ui-labeller.js
```

#### Step 3: Add Script to Layout
**For Next.js App Router (`app/layout.tsx`):**
```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* UI Labeller - Development Only */}
        {process.env.NODE_ENV === 'development' && (
          <script src="/.debug-tools/ui-labeller.js" async />
        )}
        
        {children}
      </body>
    </html>
  );
}
```

**For Next.js Pages Router (`pages/_app.tsx`):**
```tsx
import Script from 'next/script';

export default function App({ Component, pageProps }) {
  return (
    <>
      {/* UI Labeller - Development Only */}
      {process.env.NODE_ENV === 'development' && (
        <Script src="/.debug-tools/ui-labeller.js" strategy="afterInteractive" />
      )}
      
      <Component {...pageProps} />
    </>
  );
}
```

#### Step 4: Start Dev Server
```bash
npm run dev
```

✅ **Done!** Press `Ctrl+Shift+D` to activate.

---

### Method 2: Vite/React

#### Step 1: Copy Files
```bash
cp -r .debug-tools/ui-labeller /path/to/your/vite-project/public/
```

#### Step 2: Add Script to index.html
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Your App</title>
  </head>
  <body>
    <div id="root"></div>
    
    <!-- UI Labeller - Development Only -->
    <script>
      if (import.meta.env.DEV) {
        const script = document.createElement('script');
        script.src = '/ui-labeller/injector.js';
        script.async = true;
        document.body.appendChild(script);
      }
    </script>
    
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### Step 3: Start Dev Server
```bash
npm run dev
```

✅ **Done!** Press `Ctrl+Shift+D` to activate.

---

### Method 3: Create React App (CRA)

#### Step 1: Copy Files
```bash
cp -r .debug-tools/ui-labeller /path/to/your/cra-project/public/
```

#### Step 2: Add Script to public/index.html
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Your App</title>
  </head>
  <body>
    <div id="root"></div>
    
    <!-- UI Labeller - Development Only -->
    <script>
      if (process.env.NODE_ENV === 'development') {
        const script = document.createElement('script');
        script.src = '%PUBLIC_URL%/ui-labeller/injector.js';
        script.async = true;
        document.body.appendChild(script);
      }
    </script>
  </body>
</html>
```

#### Step 3: Start Dev Server
```bash
npm start
```

✅ **Done!** Press `Ctrl+Shift+D` to activate.

---

### Method 4: Tauri (Next.js + Tauri)

#### Step 1: Copy Files
```bash
cp -r .debug-tools/ui-labeller /path/to/your/tauri-project/.debug-tools/
```

#### Step 2: Deploy to Public (same as Next.js)
```bash
cd .debug-tools/ui-labeller
.\deploy.bat  # Windows
./deploy.sh   # Mac/Linux
```

#### Step 3: Add Script to Layout (same as Next.js)
```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* UI Labeller - Development Only */}
        {process.env.NODE_ENV === 'development' && (
          <script src="/.debug-tools/ui-labeller.js" async />
        )}
        
        {children}
      </body>
    </html>
  );
}
```

#### Step 4: Update Tauri Security (Important!)
**In `src-tauri/tauri.conf.json`:**
```json
{
  "security": {
    "csp": {
      "default-src": "'self'",
      "script-src": "'self' 'unsafe-inline'",  // ← Add 'unsafe-inline' for dev
      "style-src": "'self' 'unsafe-inline'"
    }
  }
}
```

**Or better - only in development:**
```json
{
  "security": {
    "csp": {
      "default-src": "'self'",
      "script-src": ["'self'", "blob:", "data:"],
      "style-src": ["'self'", "'unsafe-inline'"]
    }
  }
}
```

#### Step 5: Start Tauri Dev
```bash
npm run tauri dev
```

✅ **Done!** Press `Ctrl+Shift+D` to activate.

---

### Method 5: Plain HTML/Vanilla JS

#### Step 1: Copy File
```bash
cp .debug-tools/ui-labeller/injector.js /path/to/your/project/ui-labeller.js
```

#### Step 2: Add Script to HTML
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Your App</title>
</head>
<body>
  <div id="app"></div>
  
  <!-- UI Labeller -->
  <script src="/ui-labeller.js" async></script>
  
  <script src="/your-app.js"></script>
</body>
</html>
```

✅ **Done!** Press `Ctrl+Shift+D` to activate.

---

## 📁 What to Copy

### Minimal (Single File)
```
injector.js  (250 KB)
```
This is all you need! Self-contained with inline config.

### Complete Package (Recommended)
```
.debug-tools/ui-labeller/
├── injector.js          # Source code (edit this)
├── deploy.bat          # Windows deployment script
├── deploy.sh           # Mac/Linux deployment script
├── config.json         # Config (not used in v5.0, kept for future)
├── README.md           # Usage guide
└── INSTALLATION.md     # This file
```

---

## 🎯 Framework Compatibility

| Framework | Compatible | Notes |
|-----------|-----------|-------|
| **Next.js 13+** | ✅ Yes | App Router & Pages Router |
| **Next.js 12** | ✅ Yes | Pages Router only |
| **Vite + React** | ✅ Yes | Perfect compatibility |
| **Create React App** | ✅ Yes | Works out of the box |
| **Remix** | ✅ Yes | Add to root.tsx |
| **Gatsby** | ✅ Yes | Add to gatsby-browser.js |
| **Tauri** | ✅ Yes | Needs CSP adjustment |
| **Electron** | ✅ Yes | Works in renderer process |
| **React Native Web** | ⚠️ Partial | DOM-based components only |
| **Plain HTML + React CDN** | ✅ Yes | Works perfectly |

---

## 🔧 Customization

### Change Keyboard Shortcut
Edit `injector.js`:
```javascript
// Find this line:
if (e.ctrlKey && e.shiftKey && e.key === 'D') {

// Change to:
if (e.ctrlKey && e.altKey && e.key === 'I') {  // Ctrl+Alt+I
```

### Add Custom Semantic Patterns
Edit `detectSemanticComponent` method in `injector.js`:
```javascript
// Add your custom patterns:
if (parentClasses.some(c => c.includes('my-custom-component'))) {
  if (tag === 'h1') return 'MyComponent.Heading';
  if (tag === 'button') return 'MyComponent.Button';
  return 'MyComponent.Element';
}
```

### Change Button Position
Edit `injector.js`, find `this.toggleBtn.style.cssText`:
```javascript
// Change from bottom-right to bottom-left:
bottom: 20px;
left: 20px;   // was: right: 20px;
```

### Disable in Production
The script automatically only loads in development:
```javascript
if (process.env.NODE_ENV === 'development') {
  // Script loads here
}
```

But you can add extra checks:
```javascript
if (process.env.NODE_ENV === 'development' && !window.location.hostname.includes('vercel.app')) {
  // Only load locally, not on Vercel preview
}
```

---

## 🚀 Deployment Scripts

### deploy.bat (Windows)
```batch
@echo off
cd /d %~dp0
echo Deploying UI Labeller v5.0...
if not exist "..\..\public\.debug-tools" mkdir "..\..\public\.debug-tools"
copy /Y injector.js ..\..\public\.debug-tools\ui-labeller.js
echo Deployment complete!
echo.
echo Next steps:
echo 1. Add script tag to your layout/HTML
echo 2. Restart dev server
echo 3. Press Ctrl+Shift+D to activate
pause
```

### deploy.sh (Mac/Linux)
```bash
#!/bin/bash
cd "$(dirname "$0")"
echo "Deploying UI Labeller v5.0..."
mkdir -p ../../public/.debug-tools
cp injector.js ../../public/.debug-tools/ui-labeller.js
echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Add script tag to your layout/HTML"
echo "2. Restart dev server"
echo "3. Press Ctrl+Shift+D to activate"
```

Make it executable:
```bash
chmod +x deploy.sh
```

---

## ❓ FAQ

### Q: Do I need to install any npm packages?
**A: No!** Zero dependencies. Just copy and paste.

### Q: Will it slow down my app?
**A: No!** Only loads in development. Zero production impact.

### Q: Does it work with TypeScript?
**A: Yes!** Works with any React app regardless of TypeScript/JavaScript.

### Q: Can I use it in production?
**A: Not recommended.** It's a debug tool. But if you remove the `NODE_ENV` check, it will work.

### Q: Does it work with React 17?
**A: Yes!** Works with React 16, 17, 18, and 19.

### Q: What about Vue/Angular/Svelte?
**A: No.** React-specific tool. Uses React Fiber for component detection.

### Q: File locations show "N/A" - how to fix?
**A: This is a Turbopack/Next.js 16 limitation.** Use React DevTools Components tab instead for file locations.

### Q: Can I use it in an iframe?
**A: Yes!** Inject the script into the iframe's HTML.

### Q: Does it work with Shadow DOM?
**A: Partial.** Can inspect shadow DOM elements but may not detect React components inside.

---

## 🐛 Troubleshooting

### Inspector not activating
1. Hard refresh: `Ctrl+Shift+R`
2. Check console for `[UI Labeller v4] Initializing...`
3. Verify script loaded: DevTools > Network > filter "ui-labeller.js"

### Shows framework components instead of real names
1. Check you deployed the latest version (v5.0 with semantic detection)
2. Run deploy script again
3. Restart dev server
4. Hard refresh browser

### Button not visible
1. Check for z-index conflicts
2. Verify script loaded
3. Check browser console for errors

### Tauri: Script blocked by CSP
1. Update `tauri.conf.json` with CSP settings (see Method 4)
2. Or use `dangerousDisableAssetCspModification: true` (not recommended)

---

## 📊 What You Get

### Zero Config Features:
- ✅ Hover-to-highlight (DevTools-style)
- ✅ Click-to-copy JSON details
- ✅ Semantic component detection (Hero.Heading, Card.Image, etc.)
- ✅ 37 framework components filtered
- ✅ Floating toggle button
- ✅ Keyboard shortcut (Ctrl+Shift+D)
- ✅ Works across navigation
- ✅ Development-only (no production impact)
- ✅ No dependencies
- ✅ Framework agnostic (any React app)

### Output Format:
```json
{
  "component": "Hero.Heading",
  "componentPath": "Hero.Heading → Hero",
  "tag": "h1",
  "text": "Find Your Perfect Stay",
  "location": "N/A (Turbopack limitation)",
  "dimensions": "406×35",
  "classes": "text-[1.75rem] font-extrabold",
  "selector": "h1.text-[1.75rem]"
}
```

---

## ✅ Summary: Is It Plug-and-Play?

### YES! 🎉

For most frameworks, it's a **3-step process**:

1. **Copy** `injector.js` to your project
2. **Add** one `<script>` tag to your HTML/layout
3. **Press** `Ctrl+Shift+D` to activate

**Total setup time: 2 minutes**

### Framework-Specific Notes:

| Framework | Plug-and-Play? | Extra Steps |
|-----------|---------------|-------------|
| Next.js | ✅ Yes | Run deploy script + add script tag |
| Vite | ✅ Yes | Copy to public + add script tag |
| CRA | ✅ Yes | Copy to public + add script tag |
| Tauri | ⚠️ Almost | Add CSP config |
| Plain HTML | ✅ Yes | Just add script tag |

**No npm install, no webpack config, no build setup!**

---

## 🚀 Quick Start (Copy-Paste Ready)

```bash
# 1. Copy files
cp -r .debug-tools/ui-labeller /path/to/your/project/

# 2. Deploy (Next.js only)
cd .debug-tools/ui-labeller && ./deploy.sh

# 3. Add to your layout/HTML
# See framework-specific instructions above

# 4. Start dev server
npm run dev

# 5. Press Ctrl+Shift+D
```

**That's it!** 🎉
