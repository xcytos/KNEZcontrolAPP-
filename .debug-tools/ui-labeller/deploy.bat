@echo off
cd /d %~dp0
echo Deploying UI Labeller v3...
copy /Y config.json ..\..\public\.debug-tools\config.json
copy /Y injector.js ..\..\public\.debug-tools\ui-labeller.js
echo Deployment complete!
