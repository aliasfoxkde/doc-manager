#!/usr/bin/env node

/**
 * File Watcher Service for Doc Manager
 * Monitors the docs/ folder and provides an API for the web app
 * Run with: node scripts/file-watcher-service.js
 */

const chokidar = require('chokidar');
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const PORT = 3100;

// In-memory file cache
const fileCache = new Map();
const fileMetadata = new Map();

class FileWatcherService {
  constructor() {
    this.app = express();
    this.watcher = null;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  setupRoutes() {
    // Get all files
    this.app.get('/api/files', async (req, res) => {
      try {
        const files = await this.getAllFiles();
        res.json({ files });
      } catch (error) {
        console.error('[API] Error getting files:', error);
        res.status(500).json({ error: 'Failed to get files' });
      }
    });

    // Get specific file content
    this.app.get('/api/files/:category/:filename', async (req, res) => {
      try {
        const { category, filename } = req.params;
        const filePath = path.join(DOCS_DIR, category, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);

        res.json({
          content,
          metadata: {
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime
          }
        });
      } catch (error) {
        console.error('[API] Error reading file:', error);
        res.status(404).json({ error: 'File not found' });
      }
    });

    // Save file
    this.app.put('/api/files/:category/:filename', async (req, res) => {
      try {
        const { category, filename } = req.params;
        const { content } = req.body;
        const filePath = path.join(DOCS_DIR, category, filename);

        await fs.writeFile(filePath, content, 'utf-8');
        const stats = await fs.stat(filePath);

        // Update cache
        const cacheKey = `${category}/${filename}`;
        fileCache.set(cacheKey, {
          path: filePath,
          category,
          filename,
          content,
          modified: stats.mtime,
          size: stats.size
        });

        res.json({ success: true, modified: stats.mtime });
      } catch (error) {
        console.error('[API] Error saving file:', error);
        res.status(500).json({ error: 'Failed to save file' });
      }
    });

    // Delete file
    this.app.delete('/api/files/:category/:filename', async (req, res) => {
      try {
        const { category, filename } = req.params;
        const filePath = path.join(DOCS_DIR, category, filename);

        await fs.unlink(filePath);

        // Remove from cache
        const cacheKey = `${category}/${filename}`;
        fileCache.delete(cacheKey);
        fileMetadata.delete(cacheKey);

        res.json({ success: true });
      } catch (error) {
        console.error('[API] Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
      }
    });

    // Get cache stats
    this.app.get('/api/stats', (req, res) => {
      res.json({
        totalFiles: fileCache.size,
        categories: this.getCategoryStats(),
        lastUpdate: Date.now()
      });
    });

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        watching: this.watcher !== null,
        docsDir: DOCS_DIR
      });
    });
  }

  async getAllFiles() {
    const categories = ['documents', 'knowledge', 'research'];
    const files = [];

    for (const category of categories) {
      const categoryPath = path.join(DOCS_DIR, category);
      try {
        const entries = await fs.readdir(categoryPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isFile()) {
            const filename = entry.name;

            // Skip hidden files (starting with dot) and swap/backup files
            if (filename.startsWith('.') ||
                filename.endsWith('.swp') ||
                filename.endsWith('.swo') ||
                filename.endsWith('~') ||
                filename.endsWith('.tmp')) {
              continue;
            }

            const filePath = path.join(categoryPath, filename);
            const stats = await fs.stat(filePath);
            const cacheKey = `${category}/${filename}`;

            // Read file content for cache
            let content = fileCache.get(cacheKey)?.content;
            if (content === undefined) {
              try {
                content = await fs.readFile(filePath, 'utf-8');
                fileCache.set(cacheKey, {
                  path: filePath,
                  category,
                  filename: entry.name,
                  content,
                  modified: stats.mtime,
                  size: stats.size
                });
              } catch (err) {
                content = '';
              }
            }

            // Detect file type
            const ext = path.extname(filename).toLowerCase();
            const type = this.detectFileType(filename, content);

            files.push({
              id: cacheKey,
              category,
              filename: filename,
              type,
              size: stats.size,
              modified: stats.mtime,
              created: stats.birthtime,
              preview: content.substring(0, 200)
            });
          }
        }
      } catch (error) {
        console.error(`[Watcher] Error reading category ${category}:`, error);
      }
    }

    return files.sort((a, b) => b.modified - a.modified);
  }

  detectFileType(filename, content) {
    const ext = path.extname(filename).toLowerCase();
    const extMap = {
      '.md': 'markdown',
      '.markdown': 'markdown',
      '.html': 'html',
      '.htm': 'html',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.txt': 'text',
      '.xml': 'xml'
    };

    if (extMap[ext]) return extMap[ext];

    // Detect by content
    if (content.trim().startsWith('#')) return 'markdown';
    if (content.trim().startsWith('<')) return 'html';
    if (content.trim().startsWith('{')) return 'json';

    return 'text';
  }

  getCategoryStats() {
    const stats = {};
    for (const [key, value] of fileCache.entries()) {
      const category = value.category;
      stats[category] = (stats[category] || 0) + 1;
    }
    return stats;
  }

  async startWatcher() {
    console.log(`[Watcher] Starting file watcher for: ${DOCS_DIR}`);

    this.watcher = chokidar.watch(DOCS_DIR, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: false
    });

    // File added
    this.watcher.on('add', async (filePath) => {
      const relativePath = path.relative(DOCS_DIR, filePath);
      console.log(`[Watcher] File added: ${relativePath}`);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        const parts = relativePath.split(path.sep);
        const category = parts[0];
        const filename = parts.slice(1).join(path.sep);
        const cacheKey = `${category}/${filename}`;

        fileCache.set(cacheKey, {
          path: filePath,
          category,
          filename,
          content,
          modified: stats.mtime,
          size: stats.size
        });
      } catch (error) {
        console.error(`[Watcher] Error reading new file:`, error);
      }
    });

    // File changed
    this.watcher.on('change', async (filePath) => {
      const relativePath = path.relative(DOCS_DIR, filePath);
      console.log(`[Watcher] File changed: ${relativePath}`);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        const parts = relativePath.split(path.sep);
        const category = parts[0];
        const filename = parts.slice(1).join(path.sep);
        const cacheKey = `${category}/${filename}`;

        fileCache.set(cacheKey, {
          path: filePath,
          category,
          filename,
          content,
          modified: stats.mtime,
          size: stats.size
        });
      } catch (error) {
        console.error(`[Watcher] Error reading changed file:`, error);
      }
    });

    // File deleted
    this.watcher.on('unlink', (filePath) => {
      const relativePath = path.relative(DOCS_DIR, filePath);
      console.log(`[Watcher] File deleted: ${relativePath}`);

      const parts = relativePath.split(path.sep);
      const category = parts[0];
      const filename = parts.slice(1).join(path.sep);
      const cacheKey = `${category}/${filename}`;

      fileCache.delete(cacheKey);
      fileMetadata.delete(cacheKey);
    });

    // Error
    this.watcher.on('error', (error) => {
      console.error(`[Watcher] Error:`, error);
    });

    // Ready
    this.watcher.on('ready', () => {
      console.log('[Watcher] Initial scan complete. Watching for changes...');
    });
  }

  async start() {
    // Start file watcher
    await this.startWatcher();

    // Start API server
    this.server = this.app.listen(PORT, () => {
      console.log(`[API] File watcher API running on http://localhost:${PORT}`);
      console.log(`[API] Endpoints:`);
      console.log(`[API]   GET  /api/files - List all files`);
      console.log(`[API]   GET  /api/files/:category/:filename - Get file content`);
      console.log(`[API]   PUT  /api/files/:category/:filename - Save file`);
      console.log(`[API]   DEL  /api/files/:category/:filename - Delete file`);
      console.log(`[API]   GET  /api/stats - Get statistics`);
    });
  }

  async stop() {
    if (this.watcher) {
      await this.watcher.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}

// Start the service
if (require.main === module) {
  const service = new FileWatcherService();
  service.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Watcher] Shutting down...');
    await service.stop();
    process.exit(0);
  });
}

module.exports = FileWatcherService;
