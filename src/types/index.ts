export interface DocumentMetadata {
  id: string;
  title: string;
  type: 'markdown' | 'yaml' | 'json' | 'text';
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  path?: string;
  size: number;
  isSynced: boolean;
}

export interface Document {
  metadata: DocumentMetadata;
  content: string;
}

export interface SyncStatus {
  connected: boolean;
  lastSync: string | null;
  pendingChanges: number;
}

export interface SyncConfig {
  enabled: boolean;
  provider: 'github' | 'gitlab' | 'cloudflare' | 'local' | null;
  token?: string;
  repo?: string;
  branch?: string;
  interval?: number; // minutes
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  autoSave: boolean;
  autoSaveInterval: number; // seconds
  sync: SyncConfig;
}

export interface RepoAuditReport {
  generatedAt: string;
  totalRepositories: number;
  categories: {
    original: RepoSummary[];
    forked: RepoSummary[];
    nonGit: RepoSummary[];
  };
  recommendations: string[];
}

export interface RepoSummary {
  name: string;
  path: string;
  owner?: string;
  organization?: 'aliasfoxkde' | 'TaskWizer' | 'Wizer' | 'Other';
  language: string;
  codeQuality: {
    score: number;
    issues: number;
    warnings: number;
    errors: number;
  };
  status: 'clean' | 'modified' | 'untracked' | 'not-git';
  lastCommit?: string;
  functionalityScore: number;
  needsCleanup: boolean;
}

// Task types
export interface Task {
  id: string;
  title: string;
  listId: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  dueDate: string | null;
  notes?: string;
  tags?: string[];
}

export interface TaskList {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}
