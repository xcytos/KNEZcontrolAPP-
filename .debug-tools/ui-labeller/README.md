# UI Labeller v4 - DevTools-style Element Inspector

A lightweight debug tool for inspecting React components on your Cozinn website. Works like Chrome DevTools element picker - hover to highlight, click to copy details.

## Features

✅ **DevTools-style hover highlighting** - Blue outline follows your mouse  
✅ **Real component names** - Extracts from React Fiber (Hero, Card, Navbar, etc.)  
✅ **Click to copy** - One click copies JSON details to clipboard  
✅ **No visual clutter** - Clean overlay-free interface  
✅ **Works across navigation** - Auto-reinitializes on route changes  
✅ **Floating toggle button** - Always accessible at bottom-right  
✅ **Filters framework internals** - Skips 27+ Next.js/React internal components  

## How to Use

### Activation

**Method 1: Keyboard Shortcut**
```
Ctrl + Shift + D
```

**Method 2: Toggle Button**
- Click the 🎯 purple button at bottom-right
- Button turns red ⏹️ when active

### Inspector Active

When active, you'll see:
- ✅ Green status bar at top-right
- 🖱️ Crosshair cursor
- 🔵 Blue highlight box on hover
- 📋 Tooltip with component info

### Actions

- **Hover** over any element to see its component info
- **Click** any element to copy JSON details to clipboard
- **Escape** or click status bar to stop inspector

## Output Format

When you click an element, JSON is copied to clipboard:

```json
{
  "component": "Hero",
  "componentPath": "Hero → Container",
  "tag": "div",
  "text": "",
  "location": "Hero.tsx:15",
  "dimensions": "1024×326",
  "classes": "container mx-auto px-3",
  "selector": "div.container.mx-auto"
}
```

## Component Detection

The tool detects components in this order:

1. **React Fiber** - Walks up to 40 levels in React component tree
2. **Skip framework internals** - Filters out 27+ Next.js/React internal components:
   - Next.js Router: InnerLayoutRouter, OuterLayoutRouter, RedirectErrorBoundary, etc.
   - Next.js 16 Turbopack: HTTPAccessFallbackErrorBoundary, HTTPAccessFallbackBoundary, LoadingBoundary
   - React internals: Suspense, Fragment, ForwardRef, Memo, Context, Provider, Consumer
3. **CSS class heuristics** - Recognizes semantic patterns (hero, navbar, card, etc.)
4. **ID-based inference** - Converts element IDs to component names
5. **Tag fallback** - Shows `<tag>` when no meaningful name found

## Browser Settings for Best Results

### 1. Hard Refresh After Deployment
After running `deploy.bat` and restarting server:
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### 2. Disable Browser Cache (During Development)
**Chrome/Edge DevTools:**
1. Open DevTools (`F12`)
2. Go to **Network** tab
3. Check **"Disable cache"**
4. Keep DevTools open while testing

### 3. Clear Service Worker Cache
**If inspector seems stuck on old version:**
1. Open DevTools (`F12`)
2. Go to **Application** tab
3. Click **Service Workers** (left sidebar)
4. Click **"Unregister"** for localhost
5. Click **Storage** > **"Clear site data"**
6. Hard refresh

### 4. React DevTools (Optional - For File Locations)
**Install React DevTools Extension:**
- Chrome: [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- Edge: Same Chrome extension works

**Benefits:**
- Enables `_debugSource` in React Fiber
- Shows file locations automatically
- Better component tree inspection

### 5. Console Settings
**For debugging:**
1. Open DevTools Console (`F12` > Console)
2. Look for messages like:
   ```
   [UI Labeller v4] Initializing...
   [UI Labeller] Started - Hover over elements to inspect
   ```
3. Test commands:
   ```javascript
   window.uiLabeller.toggle()
   window.uiLabeller.isActive()
   ```

## Known Limitations

- **File locations** require React source maps (see below)
- **Server components** may not have React Fiber data
- **Third-party libraries** may show wrapper names
- **Deep nesting** beyond 40 levels won't be detected

## Enable File Locations (Optional)

To see real file paths instead of "N/A":

### Option 1: React DevTools (Easiest)
Install React DevTools browser extension - file locations work automatically!

### Option 2: Babel Plugin (Advanced)

```bash
npm install --save-dev @babel/plugin-transform-react-jsx-source
```

Update `next.config.ts`:
```typescript
module.exports = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.module.rules.push({
        test: /\.(tsx|jsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: ['@babel/plugin-transform-react-jsx-source']
          }
        }
      });
    }
    return config;
  }
};
```

## Troubleshooting

### Inspector not activating
1. **Hard refresh**: `Ctrl + Shift + R`
2. **Check console** for initialization message
3. **Verify script loaded**: DevTools > Network > filter "ui-labeller.js"
4. **Clear cache**: DevTools > Network > "Disable cache"

### Still showing framework components
If you see new framework components (like HTTPAccessFallbackErrorBoundary):
1. Note the component name
2. Add to `skipComponents` array in `injector.js`
3. Run `deploy.bat`
4. Restart dev server
5. Hard refresh browser

### No file locations
1. **Install React DevTools** extension (easiest solution)
2. **Enable source maps** in next.config.ts
3. File locations only work in **development mode**
4. Check console for `_debugSource` availability

### Button not visible
1. Check z-index conflicts (button uses z-index: 2147483647)
2. Verify script loaded in `app/layout.tsx`
3. Check for CSS that hides fixed position elements

### Old version persisting
1. **Clear service worker** (see Browser Settings above)
2. **Clear all site data** in DevTools > Application
3. **Hard refresh** multiple times
4. **Restart browser** if needed

## Development

### File Structure
```
.debug-tools/ui-labeller/
├── injector.js          # Source code (edit this)
├── deploy.bat           # Deployment script
├── config.json          # Configuration (not used in v4)
└── README.md            # This file

public/.debug-tools/
└── ui-labeller.js       # Deployed version (auto-generated)
```

### Deployment Workflow
```bash
# 1. Edit source
code .debug-tools/ui-labeller/injector.js

# 2. Deploy
cd .debug-tools/ui-labeller
.\deploy.bat

# 3. Restart server
# Stop: Ctrl+C in terminal running npm run dev
npm run dev

# 4. Test in browser
# Hard refresh: Ctrl+Shift+R
```

### Adding New Skip Components
If you encounter new framework components:

```javascript
// In injector.js, add to skipComponents array:
const skipComponents = [
  // ... existing components ...
  'YourNewFrameworkComponent'  // Add here
];
```

### Testing Changes
1. Make changes to `injector.js`
2. Run `deploy.bat`
3. Restart dev server
4. Hard refresh browser (`Ctrl+Shift+R`)
5. Open console and check for initialization message

## Console Commands

```javascript
// Toggle inspector
window.uiLabeller.toggle()

// Start inspector
window.uiLabeller.start()

// Stop inspector
window.uiLabeller.stop()

// Check if active
window.uiLabeller.isActive()

// Access config
window.uiLabeller.config
```

## Version History

- **v4.1** (June 21, 2026) - Added 27+ framework component filters, improved heuristics
- **v4.0** - Complete rewrite with DevTools-style inspection
- **v3.0** - Floating sidebar (abandoned due to overlay issues)
- **v2.0** - Basic overlay with labels
- **v1.0** - Initial prototype

## Support

For issues or questions:
1. Check console for error messages
2. Verify dev server is running
3. Try hard refresh and cache clear
4. Check this README for troubleshooting steps
