export interface Task {
  id: string;
  title: string;
  listId: string;
  completed: boolean;
  priority: TaskPriority;
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

export type TaskPriority = 'low' | 'medium' | 'high';

export interface GoogleKeepNote {
  id: string;
  title: string;
  content: string;
  labels: string[];
  color: string;
  isArchived: boolean;
  isPinned: boolean;
  isTrashed: boolean;
  timestamps: {
    created: string;
    updated: string;
  };
}

export interface GoogleKeepExport {
  notes: GoogleKeepNote[];
  labels: Array<{
    id: string;
    name: string;
  }>;
}
