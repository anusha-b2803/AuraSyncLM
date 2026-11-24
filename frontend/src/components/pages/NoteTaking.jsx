import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../../contexts/AppStateContext';

const NoteTaking = () => {
    const { state, addNote, updateNote, deleteNote } = useAppState();
    const [selectedNote, setSelectedNote] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editBuffer, setEditBuffer] = useState({ title: '', content: '' });

    const handleCreateNote = () => {
        const newNote = {
            id: Date.now().toString(),
            title: 'New Research Entry',
            content: '',
            updatedAt: new Date().toISOString()
        };
        addNote(newNote);
        setSelectedNote(newNote);
        setEditBuffer({ title: newNote.title, content: newNote.content });
        setIsEditing(true);
    };

    const handleSave = () => {
        if (selectedNote) {
            updateNote(selectedNote.id, {
                title: editBuffer.title,
                content: editBuffer.content,
                updatedAt: new Date().toISOString()
            });
            setIsEditing(false);
            setSelectedNote(prev => ({ ...prev, ...editBuffer }));
        }
    };

    const handleNoteSelect = (note) => {
        setSelectedNote(note);
        setEditBuffer({ title: note.title, content: note.content });
        setIsEditing(false);
    };

    return (
        <div className="h-full flex bg-white">
            {/* Sidebar: Note List */}
            <aside className="w-80 bg-slate-50 border-r border-slate-100 flex flex-col">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Research Notes</h3>
                    <button
                        onClick={handleCreateNote}
                        className="w-10 h-10 bg-violet-600 text-white rounded-2xl flex items-center justify-center hover:scale-105 transition-all shadow-lg shadow-violet-100"
                        title="New Note"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                    {state.notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-8 text-center opacity-20">
                            <span className="text-4xl mb-4 text-slate-400">🖋️</span>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Canvas Empty</p>
                        </div>
                    ) : (
                        state.notes.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(note => (
                            <button
                                key={note.id}
                                onClick={() => handleNoteSelect(note)}
                                className={`w-full p-6 rounded-3xl text-left transition-all border ${
                                    selectedNote?.id === note.id 
                                    ? 'bg-white border-slate-200 text-slate-900 shadow-xl shadow-slate-200/50 scale-[1.02]' 
                                    : 'bg-transparent border-transparent text-slate-400 hover:bg-white hover:text-slate-600'
                                }`}
                            >
                                <h4 className={`text-xs font-black truncate uppercase tracking-tight ${selectedNote?.id === note.id ? 'text-violet-600' : ''}`}>
                                    {note.title || 'Untitled'}
                                </h4>
                                <p className={`text-[10px] mt-2 truncate font-bold ${selectedNote?.id === note.id ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {note.content || 'Empty note...'}
                                </p>
                            </button>
                        ))
                    )}
                </div>
            </aside>

            {/* Editor Area */}
            <main className="flex-1 flex flex-col bg-white min-w-0">
                {selectedNote ? (
                    <>
                        {/* Editor Header */}
                        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
                            <div className="flex-1 mr-8">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editBuffer.title}
                                        onChange={e => setEditBuffer(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full text-3xl font-black text-slate-900 bg-transparent border-none focus:ring-0 p-0 tracking-tighter"
                                        placeholder="Note Title"
                                    />
                                ) : (
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter truncate">{selectedNote.title}</h2>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                {isEditing ? (
                                    <button
                                        onClick={handleSave}
                                        className="px-8 py-3 bg-violet-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-200"
                                    >
                                        Save Note
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-8 py-3 bg-slate-50 border border-slate-100 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-sm"
                                    >
                                        Edit Note
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        deleteNote(selectedNote.id);
                                        setSelectedNote(null);
                                    }}
                                    className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors bg-slate-50 rounded-2xl border border-slate-100"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Editor Content */}
                        <div className="flex-1 p-12 overflow-y-auto custom-scrollbar relative">
                            {isEditing ? (
                                <textarea
                                    value={editBuffer.content}
                                    onChange={e => setEditBuffer(prev => ({ ...prev, content: e.target.value }))}
                                    className="w-full h-full text-lg text-slate-600 bg-transparent border-none focus:ring-0 p-0 resize-none font-medium leading-relaxed"
                                    placeholder="Start your deep research notes..."
                                />
                            ) : (
                                <div className="text-lg text-slate-600 font-medium leading-relaxed whitespace-pre-wrap max-w-4xl">
                                    {selectedNote.content || <span className="italic opacity-30">Select 'Edit' to add content to this research entry.</span>}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-slate-50/30">
                        <div className="w-24 h-24 bg-white rounded-[40px] flex items-center justify-center mb-8 border border-slate-100 shadow-xl shadow-slate-200/50">
                            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-3 uppercase tracking-tighter">Draft Your Research</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] max-w-xs mx-auto">Select a note or create a new entry to begin your documentation.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default NoteTaking;
