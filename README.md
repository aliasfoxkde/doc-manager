# Doc Manager

A modern Document Management Progressive Web App (PWA) with local editing, cloud sync, and multi-platform support.

## Features

- **Local-First Architecture**: All documents stored locally in IndexedDB
- **Monaco Editor**: Full-featured code editor with syntax highlighting
- **Multiple Format Support**: Markdown, YAML, JSON, and plain text
- **File System Access API**: Open and save local files directly
- **Cloud Sync**: Sync with GitHub, GitLab, Cloudflare Workers, or local NAS
- **PWA Support**: Install as a desktop app, works offline
- **Dark/Light Themes**: System-aware theming
- **Real-time Search**: Fast full-text search across documents
- **Responsive Design**: Works on desktop, tablet, and mobile

## Quick Start

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Development

The app will be available at `http://localhost:3000` in development mode.

## Deployment

### Local Deployment

```bash
npm run build
npm run serve
```

### Cloudflare Pages

1. Build the app: `npm run build`
2. Deploy the `dist` folder to Cloudflare Pages
3. Configure Cloudflare Workers for backend API (optional)

### NAS Deployment

Copy the `dist` folder to your NAS web server directory.

## Document Sync

Configure sync in Settings to enable:

- **GitHub**: Sync with a GitHub repository
- **GitLab**: Sync with a GitLab project
- **Cloudflare Workers**: Custom sync backend
- **Local NAS**: Sync with local network storage

## Local File Access

Use the File System Access API to:
- Open local files directly in the editor
- Save changes back to local files
- Work with files on your NAS

## Project Structure

```
doc-manager/
├── src/
│   ├── components/     # React components
│   ├── stores/         # Zustand state management
│   ├── services/       # Business logic & API calls
│   ├── types/          # TypeScript types
│   ├── utils/          # Utility functions
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── public/             # Static assets
├── dist/               # Build output
└── package.json
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Zustand** - State management
- **Monaco Editor** - Code editor
- **IndexedDB** - Local storage
- **Vite PWA Plugin** - PWA support

## License

MIT
