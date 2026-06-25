#!/bin/bash
cd "$(dirname "$0")"
echo "Deploying UI Labeller v5.0..."
mkdir -p ../../public/.debug-tools
cp injector.js ../../public/.debug-tools/ui-labeller.js
cp config.json ../../public/.debug-tools/config.json
echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Restart dev server (npm run dev)"
echo "2. Hard refresh browser (Ctrl+Shift+R)"
echo "3. Press Ctrl+Shift+D to activate"
