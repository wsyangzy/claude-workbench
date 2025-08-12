# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Package Manager**: Use `bun` (required, not npm/yarn)

```bash
# Development
bun install              # Install dependencies
bun run dev             # Start Vite dev server
bun run tauri:dev       # Start Tauri app in dev mode

# Building
bun run build           # Build frontend (TypeScript + Vite)
bun run tauri:build     # Build full Tauri application
bun run tauri:build-fast # Build with dev-release profile
```

**TypeScript & Linting**: No explicit lint commands configured - check with `tsc` for type errors during build.

## Architecture Overview

### Frontend (React 18 + TypeScript)
- **UI Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS 4.1.8 + OKLCH color space
- **Components**: 60+ modular components in `src/components/`
- **UI Library**: Radix UI primitives (@radix-ui/react-*)
- **Animation**: Framer Motion
- **Internationalization**: i18next (Chinese-first with English support)
- **State Management**: React Context + hooks pattern

### Backend (Rust + Tauri 2)
- **Framework**: Tauri 2 (Windows-optimized desktop app)
- **Commands**: Modular command system in `src-tauri/src/commands/`
- **Core Modules**: 
  - `claude.rs` - Claude CLI integration and process management
  - `mcp.rs` - Model Context Protocol server management
  - `provider.rs` - API provider/proxy management
  - `agents.rs` - Agent system integration
  - `storage.rs` - Local data storage
- **Database**: SQLite for local data persistence
- **File System**: Comprehensive file operations with Windows API integration

### Key Integration Points
- **Claude CLI Integration**: Direct process management and parameter handling
- **MCP Protocol**: Full Model Context Protocol server support
- **Provider Management**: Silent API proxy switching without popups
- **Project Management**: Session management with checkpoint system

## Core Components Architecture

### Main Application Flow
```
App.tsx (Root)
├── Topbar.tsx (Navigation)
├── ProjectList.tsx (Project selection)
├── SessionList.tsx (Session management)
├── ClaudeCodeSession.tsx (Main Claude interaction)
├── Settings.tsx (Configuration)
│   ├── ProviderManager.tsx (API proxy management)
│   ├── MCPManager.tsx (MCP server configuration)
│   └── CheckpointSettings.tsx
└── CCAgents.tsx (Agent management)
```

### Tauri Command Architecture
```
Frontend (TypeScript) ↔ IPC ↔ Backend Commands (Rust)
                                ├── claude::execute_claude_code()
                                ├── mcp::manage_servers()
                                ├── provider::switch_provider()
                                ├── storage::save_data()
                                └── agents::manage_agents()
```

## Development Patterns

### Frontend Patterns
- **Component Structure**: Functional components with TypeScript interfaces
- **API Calls**: Use `api.ts` abstraction layer for Tauri invoke calls
- **Styling**: Tailwind CSS classes with `clsx` and `tailwind-merge` utilities
- **Forms**: React Hook Form with Zod validation
- **Error Handling**: ErrorBoundary component + toast notifications

### Backend Patterns
- **Commands**: `#[command]` decorated async functions
- **Error Handling**: `Result<T, String>` return types
- **Serialization**: serde for data transfer between frontend/backend
- **Async Operations**: tokio for concurrent operations

### File Structure Conventions
- Frontend components in `src/components/` with co-located types
- Tauri commands in `src-tauri/src/commands/` by domain
- Shared types defined in TypeScript interfaces
- UI primitives in `src/components/ui/`

## Critical Development Notes

### Claude CLI Integration
- **Parameters**: Use `-c` for continue, `--resume sessionId` for resume (NOT `--resume-project`)
- **Process Management**: Claude processes managed through Rust subprocess handling
- **Session Continuity**: Sessions managed via checkpoint system in Rust backend

### MCP (Model Context Protocol)
- Configuration stored in `.mcp.json` files
- Server management through dedicated MCP commands
- Connection testing and status monitoring built-in

### Provider/Proxy Management
- **Silent Switching**: No popup interruptions during provider changes
- **Local Storage**: All configuration stored locally, no hardcoded credentials
- **Auto-detection**: Current provider automatically identified and displayed

### Windows Optimization
- **Build Requirements**: Must use `bun run tauri:build` for cross-device compatibility
- **File Paths**: Windows-specific path handling in Rust commands
- **Process Management**: Windows API integration for Claude CLI subprocess control

### UI/UX Specifics
- **Color System**: OKLCH color space (modern browsers required)
- **Chinese-First**: UI text prioritizes Chinese with English fallback
- **Responsive Design**: Desktop-focused but responsive layout
- **Accessibility**: Radix UI provides built-in accessibility features