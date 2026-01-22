import { create } from 'zustand';
import { Task, TaskList } from '../types';
import type { TaskPriority } from '../types/tasks';
import { nanoid } from 'nanoid';
import { createProductionSafety } from '../core/productionSafety';
import { TaskContract, TaskListContract } from '../core/dataContracts';
import { getObservability } from '../core/observability';

// Initialize safety layer
const safety = createProductionSafety({
  environment: process.env.NODE_ENV || 'development',
  enableStrictValidation: true,
  blockPlaceholders: true,
  requireDataContracts: true,
  enableObservability: true,
});

// Register data contracts
safety.registerContract('task', TaskContract);
safety.registerContract('taskList', TaskListContract);

// Initialize observability
const obs = getObservability();

interface TaskState {
  tasks: Task[];
  lists: TaskList[];
  activeListId: string | null;
  filter: 'all' | 'active' | 'completed';
  searchQuery: string;
  validationErrors: string[];
  safetyEnabled: boolean;

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
  validateTask: (task: Task) => boolean;
  validateList: (list: TaskList) => boolean;
  enableSafety: () => void;
  disableSafety: () => void;
}

// Local storage helpers with validation
function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem('doc-manager-tasks');
    if (!raw) return [];

    const tasks = JSON.parse(raw);
    const validTasks: Task[] = [];
    const errors: string[] = [];

    for (const task of tasks) {
      const result = safety.validate('task', task);
      if (result.isValid) {
        validTasks.push(task);
      } else {
        errors.push(`Task "${task.title}": ${result.errors.map(e => e.message).join(', ')}`);
        obs.warn('Task validation failed during load', { taskId: task.id, errors: result.errors });
      }
    }

    if (errors.length > 0) {
      obs.error('Some tasks failed validation during load', undefined, { errorCount: errors.length });
    }

    return validTasks;
  } catch (error) {
    obs.error('Failed to load tasks from localStorage', error as Error);
    return [];
  }
}

function loadLists(): TaskList[] {
  try {
    const raw = localStorage.getItem('doc-manager-lists');
    if (!raw) {
      return [
        { id: 'default', name: 'Tasks', color: '#3b82f6', createdAt: new Date().toISOString() }
      ];
    }

    const lists = JSON.parse(raw);
    const validLists: TaskList[] = [];
    const errors: string[] = [];

    for (const list of lists) {
      const result = safety.validate('taskList', list);
      if (result.isValid) {
        validLists.push(list);
      } else {
        errors.push(`List "${list.name}": ${result.errors.map(e => e.message).join(', ')}`);
        obs.warn('List validation failed during load', { listId: list.id, errors: result.errors });
      }
    }

    if (errors.length > 0) {
      obs.error('Some lists failed validation during load', undefined, { errorCount: errors.length });
    }

    return validLists.length > 0 ? validLists : [
      { id: 'default', name: 'Tasks', color: '#3b82f6', createdAt: new Date().toISOString() }
    ];
  } catch (error) {
    obs.error('Failed to load lists from localStorage', error as Error);
    return [
      { id: 'default', name: 'Tasks', color: '#3b82f6', createdAt: new Date().toISOString() }
    ];
  }
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: loadTasks(),
  lists: loadLists(),
  activeListId: null,
  filter: 'all',
  searchQuery: '',
  validationErrors: [],
  safetyEnabled: true,

  addTask: (title, listId, priority = 'medium') => {
    const span = obs.startSpan('taskStore.addTask');
    const state = get();

    try {
      const task: Task = {
        id: nanoid(),
        title,
        listId,
        completed: false,
        priority,
        createdAt: new Date().toISOString(),
        dueDate: null
      };

      // Safety check
      if (state.safetyEnabled) {
        const safetyCheck = safety.performSafetyCheck('addTask', task);

        if (!safetyCheck.isSafe) {
          obs.error('Task creation blocked by safety check', undefined, {
            reasons: safetyCheck.blockedActions,
            recommendations: safetyCheck.recommendations,
          });

          set({ validationErrors: safetyCheck.recommendations });
          obs.endSpan(span);
          return;
        }

        // Schema validation
        const validation = safety.validate('task', task);
        if (!validation.isValid) {
          obs.error('Task schema validation failed', undefined, { errors: validation.errors });
          set({ validationErrors: validation.errors.map(e => `${e.code}: ${e.message}`) });
          obs.endSpan(span);
          return;
        }
      }

      set((state) => {
        const tasks = [...state.tasks, task];
        localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
        obs.recordMetric('task.count', tasks.length);
        obs.recordMetric('task.created', 1);
        obs.endSpan(span);
        return { tasks, validationErrors: [] };
      });
    } catch (error) {
      obs.endSpan(span, error as Error);
      obs.error('Failed to add task', error as Error);
      throw error;
    }
  },

  toggleTask: (taskId) => {
    const span = obs.startSpan('taskStore.toggleTask');
    try {
      set((state) => {
        const tasks = state.tasks.map((t) =>
          t.id === taskId ? { ...t, completed: !t.completed } : t
        );
        localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
        obs.recordMetric('task.toggled', 1);
        obs.endSpan(span);
        return { tasks };
      });
    } catch (error) {
      obs.endSpan(span, error as Error);
      obs.error('Failed to toggle task', error as Error);
    }
  },

  deleteTask: (taskId) => {
    const span = obs.startSpan('taskStore.deleteTask');
    try {
      set((state) => {
        const tasks = state.tasks.filter((t) => t.id !== taskId);
        localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
        obs.recordMetric('task.deleted', 1);
        obs.recordMetric('task.count', tasks.length);
        obs.endSpan(span);
        return { tasks };
      });
    } catch (error) {
      obs.endSpan(span, error as Error);
      obs.error('Failed to delete task', error as Error);
    }
  },

  updateTask: (taskId, updates) => {
    const span = obs.startSpan('taskStore.updateTask');
    const state = get();

    try {
      const existingTask = state.tasks.find(t => t.id === taskId);
      if (!existingTask) {
        obs.warn('Task not found for update', { taskId });
        obs.endSpan(span);
        return;
      }

      const updatedTask = { ...existingTask, ...updates };

      // Safety check
      if (state.safetyEnabled) {
        const safetyCheck = safety.performSafetyCheck('updateTask', updatedTask);

        if (!safetyCheck.isSafe) {
          obs.error('Task update blocked by safety check', undefined, {
            reasons: safetyCheck.blockedActions,
            recommendations: safetyCheck.recommendations,
          });

          set({ validationErrors: safetyCheck.recommendations });
          obs.endSpan(span);
          return;
        }

        // Schema validation
        const validation = safety.validate('task', updatedTask);
        if (!validation.isValid) {
          obs.error('Task schema validation failed', undefined, { errors: validation.errors });
          set({ validationErrors: validation.errors.map(e => `${e.code}: ${e.message}`) });
          obs.endSpan(span);
          return;
        }
      }

      set((state) => {
        const tasks = state.tasks.map((t) =>
          t.id === taskId ? updatedTask : t
        );
        localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
        obs.recordMetric('task.updated', 1);
        obs.endSpan(span);
        return { tasks, validationErrors: [] };
      });
    } catch (error) {
      obs.endSpan(span, error as Error);
      obs.error('Failed to update task', error as Error);
    }
  },

  addList: (name, color = '#3b82f6') => {
    const span = obs.startSpan('taskStore.addList');
    const state = get();

    try {
      const list: TaskList = {
        id: nanoid(),
        name,
        color,
        createdAt: new Date().toISOString()
      };

      // Safety check
      if (state.safetyEnabled) {
        const safetyCheck = safety.performSafetyCheck('addList', list);

        if (!safetyCheck.isSafe) {
          obs.error('List creation blocked by safety check', undefined, {
            reasons: safetyCheck.blockedActions,
            recommendations: safetyCheck.recommendations,
          });

          set({ validationErrors: safetyCheck.recommendations });
          obs.endSpan(span);
          return;
        }

        // Schema validation
        const validation = safety.validate('taskList', list);
        if (!validation.isValid) {
          obs.error('List schema validation failed', undefined, { errors: validation.errors });
          set({ validationErrors: validation.errors.map(e => `${e.code}: ${e.message}`) });
          obs.endSpan(span);
          return;
        }
      }

      set((state) => {
        const lists = [...state.lists, list];
        localStorage.setItem('doc-manager-lists', JSON.stringify(lists));
        obs.recordMetric('list.count', lists.length);
        obs.recordMetric('list.created', 1);
        obs.endSpan(span);
        return { lists, validationErrors: [] };
      });
    } catch (error) {
      obs.endSpan(span, error as Error);
      obs.error('Failed to add list', error as Error);
    }
  },

  deleteList: (listId) => {
    const span = obs.startSpan('taskStore.deleteList');
    try {
      set((state) => {
        const lists = state.lists.filter((l) => l.id !== listId);
        const tasks = state.tasks.filter((t) => t.listId !== listId);
        localStorage.setItem('doc-manager-lists', JSON.stringify(lists));
        localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
        obs.recordMetric('list.deleted', 1);
        obs.recordMetric('list.count', lists.length);
        obs.endSpan(span);
        return {
          lists,
          tasks,
          activeListId: state.activeListId === listId ? null : state.activeListId
        };
      });
    } catch (error) {
      obs.endSpan(span, error as Error);
      obs.error('Failed to delete list', error as Error);
    }
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
    const span = obs.startSpan('taskStore.reorderTasks');
    try {
      set((state) => {
        const activeListId = state.activeListId;
        const otherTasks = state.tasks.filter((t) => t.listId !== activeListId);
        const reordered = [...otherTasks, ...tasks];
        localStorage.setItem('doc-manager-tasks', JSON.stringify(reordered));
        obs.endSpan(span);
        return { tasks: reordered };
      });
    } catch (error) {
      obs.endSpan(span, error as Error);
      obs.error('Failed to reorder tasks', error as Error);
    }
  },

  clearCompleted: () => {
    const span = obs.startSpan('taskStore.clearCompleted');
    try {
      set((state) => {
        const tasks = state.tasks.filter((t) => !t.completed);
        localStorage.setItem('doc-manager-tasks', JSON.stringify(tasks));
        obs.recordMetric('task.cleared', state.tasks.length - tasks.length);
        obs.recordMetric('task.count', tasks.length);
        obs.endSpan(span);
        return { tasks };
      });
    } catch (error) {
      obs.endSpan(span, error as Error);
      obs.error('Failed to clear completed tasks', error as Error);
    }
  },

  validateTask: (task: Task) => {
    const result = safety.validate('task', task);
    if (!result.isValid) {
      set({ validationErrors: result.errors.map(e => `${e.code}: ${e.message}`) });
      obs.warn('Task validation failed', { errors: result.errors });
    }
    return result.isValid;
  },

  validateList: (list: TaskList) => {
    const result = safety.validate('taskList', list);
    if (!result.isValid) {
      set({ validationErrors: result.errors.map(e => `${e.code}: ${e.message}`) });
      obs.warn('List validation failed', { errors: result.errors });
    }
    return result.isValid;
  },

  enableSafety: () => {
    set({ safetyEnabled: true });
    obs.info('Task safety checks enabled');
  },

  disableSafety: () => {
    set({ safetyEnabled: false });
    obs.warn('Task safety checks disabled - placeholder data may be allowed');
  },
}));
