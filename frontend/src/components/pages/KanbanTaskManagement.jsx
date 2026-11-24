import React, { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../../contexts/AppStateContext';

const TaskCard = ({ task, onDelete }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'todo': return 'bg-violet-400';
            case 'in-progress': return 'bg-indigo-400';
            case 'done': return 'bg-emerald-400';
            default: return 'bg-slate-400';
        }
    };

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`p-6 mb-4 bg-white border border-slate-100 rounded-3xl group relative transition-all shadow-sm ${isDragging ? 'z-50 shadow-2xl scale-105 border-violet-200' : 'hover:border-violet-100'}`}
        >
            <div className="flex items-start justify-between gap-4 mb-3">
                <h4 className="text-xs font-black text-slate-900 leading-tight flex-1 uppercase tracking-tight">
                    {task.title}
                </h4>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(task.id);
                    }}
                    className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {task.description && (
                <p className="text-[10px] text-slate-400 font-bold mb-4 line-clamp-2 leading-relaxed">
                    {task.description}
                </p>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(task.status)} shadow-[0_0_8px_rgba(0,0,0,0.05)]`} />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {task.status.replace('-', ' ')}
                    </span>
                </div>
                {task.dueDate && (
                    <span className="text-[9px] text-slate-400 font-black flex items-center gap-1.5 uppercase">
                        📅 {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                )}
            </div>
        </motion.div>
    );
};

const KanbanColumn = ({ status, title, tasks, onDelete }) => {
    const { setNodeRef, isOver } = useDroppable({ id: status });

    return (
        <div ref={setNodeRef} className="flex-1 min-w-[340px] flex flex-col h-full">
            <div className={`flex-1 flex flex-col p-6 rounded-[32px] transition-all duration-300 border-2 ${isOver ? 'bg-slate-50 border-violet-200 border-dashed' : 'bg-slate-50/50 border-transparent'}`}>
                <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-3">
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            {title}
                        </h3>
                    </div>
                    <span className="text-[10px] font-black text-slate-900 bg-white border border-slate-100 px-3 py-1 rounded-full shadow-sm">
                        {tasks.length}
                    </span>
                </div>

                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        {tasks.map((task) => (
                            <TaskCard key={task.id} task={task} onDelete={onDelete} />
                        ))}
                    </div>
                </SortableContext>
            </div>
        </div>
    );
};

const KanbanTaskManagement = () => {
    const { state, addTask, updateTask, deleteTask } = useAppState();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        dueDate: '',
        status: 'todo'
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 3 },
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over) return;
        const taskId = active.id;
        const newStatus = over.id;
        const task = state.tasks.find(t => t.id === taskId);
        if (task && task.status !== newStatus) {
            updateTask(taskId, { status: newStatus });
        }
    };

    const getTasksByStatus = (status) => {
        return state.tasks.filter(t => t.status === status);
    };

    const handleCreateTask = () => {
        if (newTask.title.trim()) {
            addTask({
                id: Date.now().toString(),
                ...newTask,
                createdAt: new Date().toISOString(),
            });
            setNewTask({ title: '', description: '', dueDate: '', status: 'todo' });
            setShowCreateModal(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Academic Roadmap</h2>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Strategic Study Planning</p>
                </div>

                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-8 py-3 bg-violet-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-violet-700 transition-all shadow-lg shadow-violet-200 flex items-center gap-3"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                    New Task
                </button>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 p-8 overflow-x-auto custom-scrollbar">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <div className="flex gap-8 h-full min-w-[1100px]">
                        <KanbanColumn
                            status="todo"
                            title="ToDo"
                            tasks={getTasksByStatus('todo')}
                            onDelete={deleteTask}
                        />
                        <KanbanColumn
                            status="in-progress"
                            title="In Progress"
                            tasks={getTasksByStatus('in-progress')}
                            onDelete={deleteTask}
                        />
                        <KanbanColumn
                            status="done"
                            title="Done"
                            tasks={getTasksByStatus('done')}
                            onDelete={deleteTask}
                        />
                    </div>
                </DndContext>
            </div>

            {/* Create Task Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white border border-slate-100 rounded-[24px] p-6 w-full max-w-sm shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)]"
                        >
                            <h3 className="text-xl font-black text-slate-900 mb-5 tracking-tighter">New Roadmap Task</h3>

                            <div className="space-y-3.5">
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Title</label>
                                    <input
                                        type="text"
                                        value={newTask.title}
                                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-900 focus:outline-none focus:border-violet-300 transition-all font-bold placeholder:text-slate-300 shadow-inner text-xs"
                                        placeholder="e.g. Master Neural Networks"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Details</label>
                                    <textarea
                                        value={newTask.description}
                                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-900 focus:outline-none focus:border-violet-300 transition-all font-bold resize-none h-24 placeholder:text-slate-300 shadow-inner text-xs"
                                        placeholder="Define your specific goals..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                                        <select
                                            value={newTask.status}
                                            onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                                            className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-900 focus:outline-none focus:border-violet-300 transition-all font-bold cursor-pointer shadow-sm text-xs"
                                        >
                                            <option value="todo">To Do</option>
                                            <option value="in-progress">In Progress</option>
                                            <option value="done">Done</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Date</label>
                                        <input
                                            type="date"
                                            value={newTask.dueDate}
                                            onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                                            className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-900 focus:outline-none focus:border-violet-300 transition-all font-bold shadow-sm text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleCreateTask}
                                    className="flex-1 py-3 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-violet-700 transition-all shadow-xl shadow-violet-100"
                                >
                                    Add Task
                                </button>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-6 py-3 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-100 hover:text-slate-900 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default KanbanTaskManagement;
