import { create } from 'zustand';
import { Task, TaskList, TaskPriority } from '../types';
import { nanoid } from 'nanoid';

interface TaskState {
  tasks: Task[];
  lists: TaskList[];
  activeListId: string | null;
  filter: 'all' | 'active' | 'completed';
  searchQuery: string;

  // Actions
  addTask: (title: string, listId: string, priority?: TaskPriority) => void;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  addList: (name: string, color?: string) => void;
  deleteList: (listId: string) => void;
  setActiveList: (listId: string | null) => void;
  setFilter: (filter: 'all' | 'active' | 'completed') => void;
  setSearchQuery: (query: string) => void;
  reorderTasks: (tasks: Task[]) => void;
  clearCompleted: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: JSON.parse(localStorage.getItem('doc-manager-tasks') || '[]'),
  lists: JSON.parse(localStorage.getItem('doc-manager-lists') || '[]') || [
    { id: 'default', name: 'Tasks', color: '#3b82f6', createdAt: new Date().toISOString() }
  ],
  activeListId: null,
  filter: 'all',
  searchQuery: '',

  addTask: (title, listId, priority = 'medium') => {
    const task: Task = {
      id: nanoid(),
      title,
      listId,
      completed: false,
      priority,
      createdAt: new Date().toISOString(),
      dueDate: null
    };

    set((state) => {
      const tasks = [...state.tasks, task];
      localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
      return { tasks };
    });
  },

  toggleTask: (taskId) => {
    set((state) => {
      const tasks = state.tasks.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
      return { tasks };
    });
  },

  deleteTask: (taskId) => {
    set((state) => {
      const tasks = state.tasks.filter((t) => t.id !== taskId);
      localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
      return { tasks };
    });
  },

  updateTask: (taskId, updates) => {
    set((state) => {
      const tasks = state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t
      );
      localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
      return { tasks };
    });
  },

  addList: (name, color = '#3b82f6') => {
    const list: TaskList = {
      id: nanoid(),
      name,
      color,
      createdAt: new Date().toISOString()
    };

    set((state) => {
      const lists = [...state.lists, list];
      localStorage.setItem('doc-manager-lists', JSON.stringify(lists));
      return { lists };
    });
  },

  deleteList: (listId) => {
    set((state) => {
      const lists = state.lists.filter((l) => l.id !== listId);
      const tasks = state.tasks.filter((t) => t.listId !== listId);
      localStorage.setItem('doc-manager-lists', JSON.stringify(lists));
      localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
      return { lists, tasks, activeListId: state.activeListId === listId ? null : state.activeListId };
    });
  },

  setActiveList: (listId) => {
    set({ activeListId: listId });
  },

  setFilter: (filter) => {
    set({ filter });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  reorderTasks: (tasks) => {
    set((state) => {
      // Only reorder tasks in the active list
      const activeListId = state.activeListId;
      const otherTasks = state.tasks.filter((t) => t.listId !== activeListId);
      const reordered = [...otherTasks, ...tasks];
      localStorage.setItem('doc-manager-tasks', JSON.stringify(reordered));
      return { tasks: reordered };
    });
  },

  clearCompleted: () => {
    set((state) => {
      const tasks = state.tasks.filter((t) => !t.completed);
      localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
      return { tasks };
    });
  }
}));
