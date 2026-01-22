import { useState } from 'react';
import { useTaskStore } from '../stores/taskStore';

const priorityColors = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444'
};

export default function Tasks() {
  const {
    tasks,
    lists,
    activeListId,
    filter,
    searchQuery,
    addTask,
    toggleTask,
    deleteTask,
    addList,
    deleteList,
    setActiveList,
    setFilter,
    setSearchQuery,
    clearCompleted
  } = useTaskStore();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newListName, setNewListName] = useState('');
  const [showAddList, setShowAddList] = useState(false);

  const filteredTasks = tasks.filter((task) => {
    const matchesList = activeListId ? task.listId === activeListId : true;
    const matchesFilter =
      filter === 'all' ||
      (filter === 'active' && !task.completed) ||
      (filter === 'completed' && task.completed);
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesList && matchesFilter && matchesSearch;
  });

  const activeTasksCount = filteredTasks.filter((t) => !t.completed).length;
  const completedTasksCount = filteredTasks.filter((t) => t.completed).length;

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      addTask(newTaskTitle, activeListId || lists[0]?.id || 'default');
      setNewTaskTitle('');
    }
  };

  const handleAddList = (e: React.FormEvent) => {
    e.preventDefault();
    if (newListName.trim()) {
      addList(newListName);
      setNewListName('');
      setShowAddList(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask(e);
    }
  };

  return (
    <div className="tasks-container">
      <header className="tasks-header">
        <div className="tasks-title">
          <h2>Tasks</h2>
          <span className="task-counts">
            {activeTasksCount} active, {completedTasksCount} completed
          </span>
        </div>
        <div className="tasks-actions">
          <button onClick={() => setShowAddList(!showAddList)} className="btn-secondary">
            + New List
          </button>
          <button onClick={clearCompleted} className="btn-secondary">
            Clear Completed
          </button>
        </div>
      </header>

      <div className="tasks-layout">
        {/* Sidebar with lists */}
        <aside className="tasks-sidebar">
          <div
            className={`list-item ${activeListId === null ? 'active' : ''}`}
            onClick={() => setActiveList(null)}
          >
            <span className="list-icon">📋</span>
            <span>All Tasks</span>
            <span className="list-count">{tasks.length}</span>
          </div>

          {lists.map((list) => (
            <div
              key={list.id}
              className={`list-item ${activeListId === list.id ? 'active' : ''}`}
              onClick={() => setActiveList(list.id)}
            >
              <span
                className="list-color"
                style={{ backgroundColor: list.color }}
              />
              <span>{list.name}</span>
              <span className="list-count">
                {tasks.filter((t) => t.listId === list.id).length}
              </span>
              <button
                className="list-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this list?')) {
                    deleteList(list.id);
                  }
                }}
              >
                ×
              </button>
            </div>
          ))}

          {showAddList && (
            <form onSubmit={handleAddList} className="add-list-form">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name..."
                autoFocus
                className="input-secondary"
              />
              <button type="submit" className="btn-small">
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddList(false)}
                className="btn-small btn-secondary"
              >
                Cancel
              </button>
            </form>
          )}
        </aside>

        {/* Main task area */}
        <main className="tasks-main">
          {/* Search and filters */}
          <div className="tasks-controls">
            <input
              type="search"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <div className="filter-buttons">
              <button
                className={filter === 'all' ? 'active' : ''}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={filter === 'active' ? 'active' : ''}
                onClick={() => setFilter('active')}
              >
                Active
              </button>
              <button
                className={filter === 'completed' ? 'active' : ''}
                onClick={() => setFilter('completed')}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Add task input */}
          <form onSubmit={handleAddTask} className="add-task-form">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Add a task..."
              className="task-input"
            />
            <select
              className="priority-select"
              onChange={(e) => {
                if (newTaskTitle.trim()) {
                  addTask(newTaskTitle, activeListId || lists[0]?.id || 'default', e.target.value as any);
                  setNewTaskTitle('');
                }
              }}
            >
              <option value="" disabled>
                Priority
              </option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <button type="submit" className="btn-primary">
              Add Task
            </button>
          </form>

          {/* Task list */}
          <div className="task-list">
            {filteredTasks.length === 0 ? (
              <div className="empty-state">
                <p>No tasks found. Create your first task!</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    className="task-checkbox"
                  />
                  <div className="task-content">
                    <span className="task-title">{task.title}</span>
                    <div className="task-meta">
                      <span
                        className="task-priority"
                        style={{ color: priorityColors[task.priority] }}
                      >
                        {task.priority}
                      </span>
                      <span className="task-date">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    className="task-delete"
                    onClick={() => {
                      if (confirm('Delete this task?')) {
                        deleteTask(task.id);
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
