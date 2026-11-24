import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../../contexts/AppStateContext';

const NoteTaking = () => {
    const { state, addNote, updateNote, deleteNote } = useAppState();
    const [selectedNote, setSelectedNote] = useState(null);
    const [noteContent, setNoteContent] = useState('');
    const [noteTitle, setNoteTitle] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const handleCreateNote = () => {
        const newNote = {
            id: Date.now().toString(),
            title: 'Untitled Note',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        addNote(newNote);
        setSelectedNote(newNote);
        setNoteTitle(newNote.title);
        setNoteContent(newNote.content);
    };

    const handleSelectNote = (note) => {
        setSelectedNote(note);
        setNoteTitle(note.title);
        setNoteContent(note.content);
    };

    const handleSaveNote = () => {
        if (selectedNote) {
            updateNote(selectedNote.id, {
                ...selectedNote,
                title: noteTitle || 'Untitled Note',
                content: noteContent,
                updatedAt: new Date().toISOString(),
            });
        }
    };

    const handleDeleteNote = (noteId) => {
        deleteNote(noteId);
        if (selectedNote?.id === noteId) {
            setSelectedNote(null);
            setNoteTitle('');
            setNoteContent('');
        }
    };

    const filteredNotes = state.notes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex gap-3 p-4">
            {/* Notes List Sidebar */}
            <div className="w-64 flex flex-col">
                <div className="mb-3">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">📝 Notes</h3>
                    <button
                        onClick={handleCreateNote}
                        className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-all ripple"
                    >
                        + New Note
                    </button>
                </div>

                {/* Search */}
                <input
                    type="text"
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] mb-3 focus:outline-none focus:border-primary-500"
                />

                {/* Notes List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    <AnimatePresence>
                        {filteredNotes.length === 0 ? (
                            <div className="text-center py-4 text-[var(--text-tertiary)] text-xs">
                                No notes found
                            </div>
                        ) : (
                            filteredNotes.map(note => (
                                <motion.div
                                    key={note.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className={`glass rounded-lg p-3 cursor-pointer transition-all ${selectedNote?.id === note.id
                                            ? 'border-2 border-primary-500'
                                            : 'border border-[var(--border-color)] hover:border-primary-400'
                                        }`}
                                    onClick={() => handleSelectNote(note)}
                                >
                                    <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1 truncate">
                                        {note.title}
                                    </h4>
                                    <p className="text-xs text-[var(--text-tertiary)] truncate mb-2">
                                        {note.content || 'Empty note'}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-[var(--text-tertiary)]">
                                            {new Date(note.updatedAt).toLocaleDateString()}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteNote(note.id);
                                            }}
                                            className="text-red-400 hover:text-red-300 text-xs"
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

            {/* Note Editor */}
            <div className="flex-1 flex flex-col">
                {selectedNote ? (
                    <>
                        {/* Title Input */}
                        <input
                            type="text"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            onBlur={handleSaveNote}
                            className="w-full bg-transparent border-b-2 border-[var(--border-color)] px-0 py-3 text-xl font-semibold text-[var(--text-primary)] mb-4 focus:outline-none focus:border-primary-500"
                            placeholder="Note title..."
                        />

                        {/* Content Editor */}
                        <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            onBlur={handleSaveNote}
                            className="flex-1 bg-transparent text-[var(--text-primary)] text-sm resize-none focus:outline-none custom-scrollbar"
                            placeholder="Start typing your note..."
                        />

                        {/* Footer Info */}
                        <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex justify-between text-xs text-[var(--text-tertiary)]">
                            <span>Last saved: {new Date(selectedNote.updatedAt).toLocaleString()}</span>
                            <span>{noteContent.length} characters</span>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)]">
                        <div className="text-center">
                            <p className="text-4xl mb-3">📝</p>
                            <p className="text-sm">Select a note or create a new one</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NoteTaking;
