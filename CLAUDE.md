# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Doc Manager is a Progressive Web App (PWA) for document management with integrated Google Keep-style task management. It features a local-first architecture with optional cloud sync, built with React 18, TypeScript, Vite, and Zustand.

## Development Commands

```bash
# Setup
npm install

# Development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Code quality
npm run lint         # ESLint
npm run format       # Prettier
npm run type-check   # TypeScript type checking (tsc --noEmit)
```

## Architecture Overview

### Local-First Design
- All documents stored in IndexedDB (`src/services/documentService.ts`) for offline access
- Tasks persisted in localStorage (`src/stores/taskStore.ts`)
- File System Access API for direct local file operations (open/save)
- No backend required for core functionality

### State Management Pattern
Zustand stores handle all reactive state. Each store follows this pattern:
- State interface with properties and actions
- Async actions wrap service layer calls
- Local storage persistence for tasks, IndexedDB for documents

**Three main stores:**
1. `documentStore` (`src/stores/documentStore.ts`) - Document CRUD, search, sync
2. `taskStore` (`src/stores/taskStore.ts`) - Google Keep-style task lists with priorities
3. `themeStore` (`src/stores/themeStore.ts`) - Dark/light theme switching

### Service Layer
`src/services/documentService.ts` contains all business logic:
- IndexedDB operations (openDB, getAll, get, put, delete)
- File System Access API wrappers (openLocalFile, saveLocalFile)
- Sync placeholder for future Cloudflare/GitHub/NAS integration

### Key Data Structures

**Document** (`src/types/index.ts`):
```typescript
interface Document {
  metadata: {
    id, title, type, createdAt, updatedAt, tags, path, size, isSynced
  }
  content: string
}
```

**Task** (`src/types/tasks.ts`):
```typescript
interface Task {
  id, title, listId, completed, priority, createdAt, dueDate, notes, tags
}
```

Document types: `markdown | yaml | json | text`
Task priorities: `low | medium | high`

### PWA Configuration
`vite.config.ts` defines:
- Manifest with shortcuts (e.g., "New Document" quick action)
- Service worker with auto-update strategy
- Runtime caching for CDN assets (jsDelivr, 30-day expiry)
- Manual chunks for Monaco and React vendor to optimize bundle size

### Routing
`src/App.tsx` uses React Router DOM:
- `/` - Dashboard (document list)
- `/editor/:id` - Document editor with Monaco
- `/tasks` - Google Keep-style task manager
- `/settings` - Sync configuration and app settings

## Important Patterns

### When Adding New Document Types
1. Update `DocumentMetadata['type']` in `src/types/index.ts`
2. Add file extension mapping in `documentService.ts` (`getFileType`, `getFileExtension`)
3. Update Monaco editor language mapping in `DocumentEditor.tsx`

### When Modifying State
Always use Zustand store actions, never mutate state directly. Stores automatically persist to their respective storage (IndexedDB or localStorage).

### Sync Implementation
The `syncDocuments()` function in `documentService.ts` is a placeholder. Future implementations should:
- Check sync config from settings
- Implement provider-specific logic (GitHub, GitLab, Cloudflare, NAS)
- Update sync state in IndexedDB `sync-state` store
- Handle conflict resolution

### File System Access API
- `openLocalFile()` uses `showOpenFilePicker()` (Chrome/Edge only)
- `saveLocalFile()` uses `showSaveFilePicker()`
- Feature detection required - throws if not supported

## Component Structure

- `Dashboard.tsx` - Document list with search and filtering
- `DocumentEditor.tsx` - Monaco editor integration with toolbar
- `DocumentList.tsx` - Reusable document listing component
- `Tasks.tsx` - Full Google Keep clone with lists, priorities, drag-drop
- `Layout.tsx` - App shell with navigation and theme toggle
- `Settings.tsx` - Sync configuration and editor preferences
- `SyncStatus.tsx` - Visual sync status indicator

## Build Output

Production builds go to `dist/` with:
- Separate chunks for Monaco editor and React vendor
- Service worker auto-registration
- Sourcemaps enabled
- PWA manifest injected

## Dependencies Note

- `idb` - IndexedDB promise wrapper
- `nanoid` - Unique ID generation
- `date-fns` - Date formatting
- `monaco-editor` - VS Code's editor
- `zustand` - Lightweight state management (no context providers needed)
