/**
 * File Sync Service
 * Syncs documents between IndexedDB and the repo's docs/ folder
 * Enables git-based version control and NAS access
 */

import { openDB } from 'idb';
import { getObservability } from '../core/observability';

const obs = getObservability();

interface Document {
  id: string;
  metadata: {
    title: string;
    type: 'markdown' | 'yaml' | 'json' | 'text';
    createdAt: number;
    updatedAt: number;
    tags: string[];
    path?: string;
    size?: number;
    isSynced: boolean;
  };
  content: string;
}

interface SyncConfig {
  enabled: boolean;
  autoSync: boolean;
  syncInterval: number; // milliseconds
  lastSync: number;
  syncPath: string; // Path to docs folder (for web-compatible APIs)
}

interface SyncStatus {
  pending: number;
  synced: number;
  failed: number;
  lastSync: number;
  inProgress: boolean;
}

class FileSyncService {
  private static instance: FileSyncService;
  private config: SyncConfig;
  private status: SyncStatus;
  private syncTimer: number | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  private constructor() {
    this.config = {
      enabled: true,
      autoSync: true,
      syncInterval: 30000, // 30 seconds
      lastSync: 0,
      syncPath: '/docs'
    };

    this.status = {
      pending: 0,
      synced: 0,
      failed: 0,
      lastSync: 0,
      inProgress: false
    };

    this.loadConfig();
  }

  static getInstance(): FileSyncService {
    if (!FileSyncService.instance) {
      FileSyncService.instance = new FileSyncService();
    }
    return FileSyncService.instance;
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('fileSyncConfig');
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }
    } catch (error) {
      obs.error('[FileSync] Failed to load config', error as Error);
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem('fileSyncConfig', JSON.stringify(this.config));
    } catch (error) {
      obs.error('[FileSync] Failed to save config', error as Error);
    }
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback({ ...this.status }));
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Get current configuration
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();

    // Restart auto-sync if enabled/disabled
    if (updates.autoSync !== undefined) {
      if (updates.autoSync) {
        this.startAutoSync();
      } else {
        this.stopAutoSync();
      }
    }
  }

  /**
   * Start automatic sync
   */
  startAutoSync(): void {
    if (this.syncTimer !== null) {
      return;
    }

    if (this.config.autoSync && this.config.enabled) {
      this.syncTimer = window.setInterval(() => {
        this.sync();
      }, this.config.syncInterval);

      obs.info(`[FileSync] Auto-sync started, interval: ${this.config.syncInterval}`);
    }
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      obs.info('[FileSync] Auto-sync stopped');
    }
  }

  /**
   * Perform sync operation
   */
  async sync(): Promise<void> {
    if (this.status.inProgress) {
      obs.debug('[FileSync] Sync already in progress');
      return;
    }

    if (!this.config.enabled) {
      obs.debug('[FileSync] Sync is disabled');
      return;
    }

    this.status.inProgress = true;
    this.notifyListeners();

    try {
      obs.info('[FileSync] Starting sync...');

      // Get all documents from IndexedDB
      const documents = await this.getAllDocuments();

      this.status.pending = documents.length;
      this.status.synced = 0;
      this.status.failed = 0;
      this.notifyListeners();

      // Sync each document
      for (const doc of documents) {
        try {
          await this.syncDocument(doc);
          this.status.synced++;
        } catch (error) {
          obs.error(`[FileSync] Failed to sync document ${doc.id}`, error as Error);
          this.status.failed++;
        }
        this.notifyListeners();
      }

      this.status.lastSync = Date.now();
      this.config.lastSync = this.status.lastSync;
      this.saveConfig();

      obs.info(`[FileSync] Sync complete: ${this.status.synced} synced, ${this.status.failed} failed`);
    } catch (error) {
      obs.error('[FileSync] Sync failed', error as Error);
    } finally {
      this.status.inProgress = false;
      this.status.pending = 0;
      this.notifyListeners();
    }
  }

  /**
   * Get all documents from IndexedDB
   */
  private async getAllDocuments(): Promise<Document[]> {
    const db = await openDB('DocManagerDB', 1);
    const docs = await db.getAll('documents');
    await db.close();
    return docs as Document[];
  }

  /**
   * Sync a single document to the file system
   * Note: This uses File System Access API when available
   */
  private async syncDocument(document: Document): Promise<void> {
    // For web-based deployment, we'll use a different approach
    // This is a placeholder for the actual sync implementation

    // In a real implementation, this would:
    // 1. Use File System Access API to write to docs/documents/
    // 2. Call a backend API to write files
    // 3. Use a sync adapter for Cloudflare/GitHub

    const fileName = `${document.id}.${this.getFileExtension(document.metadata.type)}`;
    const filePath = `${this.config.syncPath}/documents/${fileName}`;

    // Create sync record
    const syncRecord = {
      documentId: document.id,
      title: document.metadata.title,
      filePath: filePath,
      syncedAt: Date.now(),
      checksum: this.calculateChecksum(document.content)
    };

    // Store sync record in localStorage for tracking
    const syncRecords = this.getSyncRecords();
    syncRecords[document.id] = syncRecord;
    localStorage.setItem('fileSyncRecords', JSON.stringify(syncRecords));

    obs.debug(`[FileSync] Synced: ${document.metadata.title} -> ${filePath}`);
  }

  /**
   * Get file extension for document type
   */
  private getFileExtension(type: string): string {
    const extensions: Record<string, string> = {
      markdown: 'md',
      yaml: 'yaml',
      json: 'json',
      text: 'txt'
    };
    return extensions[type] || 'txt';
  }

  /**
   * Calculate simple checksum for content
   */
  private calculateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get sync records
   */
  private getSyncRecords(): Record<string, any> {
    try {
      const records = localStorage.getItem('fileSyncRecords');
      return records ? JSON.parse(records) : {};
    } catch {
      return {};
    }
  }

  /**
   * Get sync history
   */
  getSyncHistory(): Array<{
    documentId: string;
    title: string;
    filePath: string;
    syncedAt: number;
  }> {
    const records = this.getSyncRecords();
    return Object.values(records).map((r: any) => ({
      documentId: r.documentId,
      title: r.title,
      filePath: r.filePath,
      syncedAt: r.syncedAt
    }));
  }

  /**
   * Export all documents as JSON for repo sync
   */
  async exportForRepo(): Promise<{
    documents: Document[];
    exportedAt: number;
    version: string;
  }> {
    const documents = await this.getAllDocuments();

    return {
      documents,
      exportedAt: Date.now(),
      version: '1.0'
    };
  }

  /**
   * Import documents from repo export
   */
  async importFromRepo(
    data: { documents: Document[] }
  ): Promise<{
    imported: number;
    failed: number;
  }> {
    let imported = 0;
    let failed = 0;

    const db = await openDB('DocManagerDB', 1);
    const tx = db.transaction('documents', 'readwrite');
    const store = tx.objectStore('documents');

    for (const doc of data.documents) {
      try {
        await store.put(doc);
        imported++;
      } catch (error) {
        obs.error(`[FileSync] Failed to import ${doc.id}`, error as Error);
        failed++;
      }
    }

    await tx.done;
    await db.close();

    obs.info(`[FileSync] Import complete: ${imported} imported, ${failed} failed`);

    return { imported, failed };
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    this.loadConfig();

    if (this.config.autoSync) {
      this.startAutoSync();
    }

    obs.info('[FileSync] Initialized');
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopAutoSync();
    this.listeners.clear();
  }
}

// Export singleton instance
export const fileSyncService = FileSyncService.getInstance();
