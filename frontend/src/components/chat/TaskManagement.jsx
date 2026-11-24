import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../../contexts/AppStateContext';

const TaskManagement = () => {
    const { state, addTask, updateTask, deleteTask } = useAppState();
    const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', status: 'todo' });
    const [filter, setFilter] = useState('all');
    const [editingId, setEditingId] = useState(null);

    const handleAddTask = () => {
        if (newTask.title.trim()) {
            addTask({
                id: Date.now().toString(),
                ...newTask,
                createdAt: new Date().toISOString(),
            });
            setNewTask({ title: '', description: '', dueDate: '', status: 'todo' });
        }
    };

    const handleToggleStatus = (task) => {
        const nextStatus = {
            'todo': 'in-progress',
            'in-progress': 'done',
            'done': 'todo'
        };
        updateTask(task.id, { ...task, status: nextStatus[task.status] });
    };

    const filteredTasks = state.tasks.filter(task => {
        if (filter === 'all') return true;
        return task.status === filter;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'todo': return 'bg-gray-500';
            case 'in-progress': return 'bg-yellow-500';
            case 'done': return 'bg-green-500';
            default: return 'bg-gray-500';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'todo': return 'To Do';
            case 'in-progress': return 'In Progress';
            case 'done': return 'Done';
            default: return status;
        }
    };

    return (
        <div className="h-full flex flex-col p-4">
            {/* Header with Filters */}
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">📋 Task Management</h3>
                <div className="flex gap-2">
                    {['all', 'todo', 'in-progress', 'done'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f
                                    ? 'bg-primary-500 text-white'
                                    : 'glass border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                        >
                            {f === 'all' ? 'All' : getStatusLabel(f)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Add New Task */}
            <div className="glass rounded-lg p-3 mb-4">
                <input
                    type="text"
                    placeholder="Task title..."
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] mb-2 focus:outline-none focus:border-primary-500"
                />
                <textarea
                    placeholder="Description (optional)..."
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] mb-2 resize-none focus:outline-none focus:border-primary-500"
                    rows="2"
                />
                <div className="flex gap-2">
                    <input
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                        className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-primary-500"
                    />
                    <button
                        onClick={handleAddTask}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-all ripple"
                    >
                        Add Task
                    </button>
                </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                <AnimatePresence>
                    {filteredTasks.length === 0 ? (
                        <div className="text-center py-8 text-[var(--text-tertiary)]">
                            <p className="text-sm">No tasks yet. Create one above!</p>
                        </div>
                    ) : (
                        filteredTasks.map(task => (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="glass rounded-lg p-3 hover-glow-enhanced cursor-pointer"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Status Indicator */}
                                    <button
                                        onClick={() => handleToggleStatus(task)}
                                        className={`w-5 h-5 rounded-full ${getStatusColor(task.status)} flex-shrink-0 mt-0.5 transition-all hover:scale-110`}
                                        title="Click to change status"
                                    >
                                        {task.status === 'done' && <span className="text-white text-xs">✓</span>}
                                    </button>

                                    {/* Task Content */}
                                    <div className="flex-1">
                                        <h4 className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                                            {task.title}
                                        </h4>
                                        {task.description && (
                                            <p className="text-xs text-[var(--text-secondary)] mt-1">{task.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(task.status)} text-white`}>
                                                {getStatusLabel(task.status)}
                                            </span>
                                            {task.dueDate && (
                                                <span className="text-xs text-[var(--text-tertiary)]">
                                                    📅 {new Date(task.dueDate).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={() => deleteTask(task.id)}
                                        className="text-red-400 hover:text-red-300 transition-colors"
                                        title="Delete task"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default TaskManagement;
