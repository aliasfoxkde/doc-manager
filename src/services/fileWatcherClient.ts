/**
 * File Watcher API Client
 * Connects to the file watcher service to fetch files from the docs/ folder
 */

import { getObservability } from '../core/observability';

const obs = getObservability();
const API_BASE = 'http://192.168.1.201:3100/api';

export interface FileWatcherFile {
  id: string;
  category: string;
  filename: string;
  type: 'markdown' | 'html' | 'json' | 'yaml' | 'text' | 'xml';
  size: number;
  modified: string;
  created: string;
  preview: string;
}

export interface FileWatcherContent {
  content: string;
  metadata: {
    size: number;
    modified: string;
    created: string;
  };
}

export interface FileWatcherStats {
  totalFiles: number;
  categories: Record<string, number>;
  lastUpdate: number;
}

class FileWatcherClient {
  private enabled: boolean = true;

  async checkAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      this.enabled = data.status === 'ok' && data.watching;
      return this.enabled;
    } catch {
      this.enabled = false;
      return false;
    }
  }

  async getAllFiles(): Promise<FileWatcherFile[]> {
    if (!this.enabled) {
      throw new Error('File watcher service is not available');
    }

    const response = await fetch(`${API_BASE}/files`);
    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  }

  async getFile(category: string, filename: string): Promise<FileWatcherContent> {
    if (!this.enabled) {
      throw new Error('File watcher service is not available');
    }

    const response = await fetch(`${API_BASE}/files/${category}/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    return await response.json();
  }

  async saveFile(category: string, filename: string, content: string): Promise<void> {
    if (!this.enabled) {
      throw new Error('File watcher service is not available');
    }

    const response = await fetch(`${API_BASE}/files/${category}/${filename}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      throw new Error(`Failed to save file: ${response.statusText}`);
    }
  }

  async deleteFile(category: string, filename: string): Promise<void> {
    if (!this.enabled) {
      throw new Error('File watcher service is not available');
    }

    const response = await fetch(`${API_BASE}/files/${category}/${filename}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }

  async getStats(): Promise<FileWatcherStats> {
    if (!this.enabled) {
      throw new Error('File watcher service is not available');
    }

    const response = await fetch(`${API_BASE}/stats`);
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.statusText}`);
    }

    return await response.json();
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const fileWatcherClient = new FileWatcherClient();

// Auto-check availability on import
fileWatcherClient.checkAvailable().catch(() => {
  obs.warn('[FileWatcher] Service not available - using IndexedDB only');
});
