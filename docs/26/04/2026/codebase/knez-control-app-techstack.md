# knez-control-app Tech Stack Documentation

## Overview

The knez-control-app is a desktop application built with React, TypeScript, and Tauri. It serves as the control interface for the KNEZ (Knowledge Neural Execution Zone) backend system, providing chat functionality, MCP (Model Control Plane) orchestration, and cognitive system monitoring.

## Frontend Technologies

### Core Framework
- **React 18.3.1** - UI library for building the user interface
- **TypeScript 5.6.3** - Type-safe JavaScript superset for enhanced development experience
- **Vite 6.0.3** - Build tool and development server with fast HMR (Hot Module Replacement)

### Desktop Runtime
- **Tauri 2.1.0** - Rust-based desktop application framework
  - Provides native OS integration
  - Enables shell command execution via `@tauri-apps/plugin-shell`
  - File system access via `@tauri-apps/plugin-fs`
  - HTTP client via `@tauri-apps/plugin-http`
  - Single instance enforcement via `@tauri-apps/plugin-single-instance`

### Styling
- **TailwindCSS 4.0.0** - Utility-first CSS framework for rapid UI development
- **PostCSS 8.4.49** - CSS transformation tool for TailwindCSS processing

### State Management
- **React Hooks** - Built-in state management (useState, useEffect, useMemo, useRef)
- **Custom Hooks** - Application-specific hooks for TAQWIN activation status, system status, etc.

### Client-Side Database
- **Dexie 4.0.8** - IndexedDB wrapper for local data persistence
  - Session storage
  - Message history
  - Tool execution traces

### Testing
- **Vitest 2.1.8** - Unit testing framework compatible with Vite
- **Playwright 1.49.1** - End-to-end testing framework for browser automation

### Build Tools
- **@vitejs/plugin-react 4.3.4** - React plugin for Vite
- **TypeScript ESLint 8.19.1** - TypeScript linting
- **ESLint 9.17.0** - JavaScript/TypeScript linting
- **eslint-plugin-react-hooks 5.0.0** - React Hooks linting rules

## Backend Technologies (Tauri Rust)

### Core Dependencies
- **tauri 2.1.0** - Main Tauri framework
- **tauri-plugin-shell** - Shell command execution
- **tauri-plugin-fs** - File system operations
- **tauri-plugin-http** - HTTP client functionality
- **tauri-plugin-single-instance** - Single application instance enforcement

### Serialization
- **serde 1.0** - Rust serialization framework
- **serde_json 1.0** - JSON serialization/deserialization

### Utilities
- **uuid 1.0** - UUID generation for session IDs and unique identifiers

## Key Frontend Libraries

### UI Components
- **lucide-react** - Icon library for React (used for UI icons like Bug, Download, Upload, etc.)

### Logging
- **Custom LogService** - Application-specific logging service with throttling and level control

### WebSocket
- **Custom WebSocketClient** - Real-time communication with KNEZ backend for event streaming

### MCP (Model Control Plane)
- **Custom McpOrchestrator** - Manages MCP server lifecycle and tool discovery
- **Custom McpStdioClient** - STDIO-based MCP client implementation
- **Custom McpInspectorService** - MCP server inspection and monitoring
- **Custom ToolExposureService** - Tool catalog and exposure management

### Session Management
- **Custom SessionController** - Session lifecycle management (create, fork, resume)
- **Custom SessionDatabase** - Dexie-based session persistence

### Chat Service
- **Custom ChatService** - Core chat orchestration with phase management, streaming, and tool execution

## Development Dependencies

### TypeScript
- **@types/react 18.3.12** - React type definitions
- **@types/react-dom 18.3.1** - React DOM type definitions
- **typescript-eslint 8.19.1** - TypeScript ESLint parser

### Build Tools
- **vite 6.0.3** - Build tool and dev server
- **@vitejs/plugin-react 4.3.4** - React plugin for Vite
- **postcss 8.4.49** - CSS processing
- **tailwindcss 4.0.0** - CSS framework

### Testing
- **@playwright/test 1.49.1** - Playwright test runner
- **vitest 2.1.8** - Vitest test runner
- **@vitest/ui 2.1.8** - Vitest UI interface

### Linting
- **eslint 9.17.0** - JavaScript/TypeScript linter
- **eslint-plugin-react-hooks 5.0.0** - React Hooks linting
- **typescript-eslint 8.19.1** - TypeScript ESLint plugin

## Application Architecture

### Build System
- **Vite** handles:
  - Fast development server with HMR
  - TypeScript compilation
  - TailwindCSS processing
  - Production bundle optimization
  - Asset handling

### Tauri Integration
- **Tauri** provides:
  - Native window management
  - OS-level permissions
  - Shell command execution
  - File system access
  - HTTP client with CORS bypass
  - Single instance enforcement

### Data Flow
1. **User Input** → React Components (ChatPane, etc.)
2. **State Management** → React Hooks + Custom Services
3. **API Communication** → KnezClient (HTTP + WebSocket)
4. **Local Persistence** → Dexie (IndexedDB)
5. **Native Operations** → Tauri IPC (Shell, FS, HTTP)

## Configuration Files

### package.json
Defines all frontend dependencies, scripts, and metadata for the React application.

### src-tauri/Cargo.toml
Defines Rust dependencies for the Tauri backend.

### tailwind.config.js
Configures TailwindCSS styling rules and theme customization.

### tsconfig.json
Configures TypeScript compiler options for type checking and compilation.

### vite.config.ts
Configures Vite build tool, plugins, and development server settings.

## Environment Variables

The application supports environment variables via Vite:
- `VITE_ENABLE_MCP_RUNTIME_REPORT` - Enables MCP runtime reporting to backend
- Other configuration is managed through Tauri's configuration system

## Browser Compatibility

The application targets modern browsers with ES2020+ support:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

Desktop deployment via Tauri provides consistent behavior across:
- Windows
- macOS
- Linux

## Performance Considerations

### Build Optimization
- Vite provides fast cold starts and HMR
- Production builds are minified and tree-shaken
- Code splitting for optimal loading

### Runtime Performance
- React 18 with concurrent features
- Memoization via useMemo and useCallback
- Throttled logging to prevent performance degradation
- Efficient state updates via React's reconciliation

### Storage Performance
- Dexie uses IndexedDB for efficient local storage
- Session data is persisted locally for offline capability
- Tool execution traces are stored for debugging

## Security Considerations

### Tauri Security
- Tauri provides a security sandbox for web content
- File system access requires explicit permissions
- Shell command execution is controlled via Tauri's capability system

### Data Security
- Local storage uses IndexedDB (browser sandbox)
- No sensitive data is stored in localStorage
- Session IDs are generated via UUID

### Network Security
- HTTP requests go through Tauri's HTTP client (CORS bypass for local development)
- WebSocket connections for real-time event streaming
- Profile-based trust management for KNEZ backend connections

## Development Workflow

### Starting Development Server
```bash
npm run dev
```
Starts Vite dev server with HMR and Tauri development window.

### Building for Production
```bash
npm run tauri build
```
Creates optimized production builds for the target platform.

### Running Tests
```bash
npm run test
```
Runs Vitest unit tests.

```bash
npm run test:e2e
```
Runs Playwright end-to-end tests.

### Linting
```bash
npm run lint
```
Runs ESLint to check code quality.

## Summary

The knez-control-app uses a modern, type-safe tech stack optimized for desktop applications:
- **React + TypeScript** for UI development
- **Tauri** for desktop integration and native capabilities
- **Vite** for fast development and optimized builds
- **Dexie** for local data persistence
- **TailwindCSS** for rapid UI styling
- **Custom services** for MCP orchestration, chat management, and session handling

This combination provides a performant, maintainable, and feature-rich control interface for the KNEZ backend system.
