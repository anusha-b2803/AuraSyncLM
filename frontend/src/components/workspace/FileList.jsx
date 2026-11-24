import React from 'react';
import { motion } from 'framer-motion';
import { useFavorites } from '../../hooks/useFavorites';
import { useAppState } from '../../contexts/AppStateContext';

const FileList = ({ files, contexts, onFileClick, onContextClick }) => {
    const { isFavorite, toggleFavorite } = useFavorites();
    const { togglePin } = useAppState();

    const getFileIcon = (file) => {
        const type = file.type || 'other';
        const icons = {
            pdf: '📄',
            docx: '📝',
            txt: '📃',
            image: '🖼️',
            video: '🎥',
            code: '💻',
            other: '📎',
        };
        return icons[type] || icons.other;
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '-';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-lg overflow-hidden"
            >
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] uppercase">
                    <div className="col-span-1 flex items-center justify-center">📌</div>
                    <div className="col-span-1 flex items-center justify-center">⭐</div>
                    <div className="col-span-4">Name</div>
                    <div className="col-span-2">Size</div>
                    <div className="col-span-2">Modified</div>
                    <div className="col-span-2">Contexts</div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-[var(--border-color)]">
                    {files.length === 0 ? (
                        <div className="px-4 py-12 text-center text-[var(--text-tertiary)] text-sm">
                            No files found
                        </div>
                    ) : (
                        files.map((file, index) => (
                            <motion.div
                                key={file.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer group"
                                onClick={() => onFileClick(file)}
                            >
                                {/* Pin Button */}
                                <div className="col-span-1 flex items-center justify-center">
                                    <motion.button
                                        whileHover={{ scale: 1.2, rotate: -15 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            togglePin(file.id);
                                        }}
                                        className="text-lg hover:brightness-125 transition-all"
                                    >
                                        {file.pinned ? '📌' : '📍'}
                                    </motion.button>
                                </div>

                                {/* Favorite Star */}
                                <div className="col-span-1 flex items-center justify-center">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFavorite(file.id);
                                        }}
                                        className="text-lg hover:scale-110 transition-transform"
                                    >
                                        {isFavorite(file.id) ? '⭐' : '☆'}
                                    </button>
                                </div>

                                {/* File Name with Icon */}
                                <div className="col-span-4 flex items-center gap-2 min-w-0">
                                    <span className="text-xl flex-shrink-0">{getFileIcon(file)}</span>
                                    <span className="text-sm text-[var(--text-primary)] font-medium truncate">
                                        {file.name}
                                    </span>
                                </div>

                                {/* File Size */}
                                <div className="col-span-2 flex items-center text-sm text-[var(--text-secondary)]">
                                    {formatFileSize(file.size)}
                                </div>

                                {/* Modified Date */}
                                <div className="col-span-2 flex items-center text-sm text-[var(--text-secondary)]">
                                    {formatDate(file.modifiedAt || file.createdAt)}
                                </div>

                                {/* Context Tags */}
                                <div className="col-span-2 flex items-center gap-1 flex-wrap">
                                    {file.contexts && file.contexts.length > 0 ? (
                                        <>
                                            {file.contexts.slice(0, 2).map((contextId) => {
                                                const context = contexts.find(c => c.id === contextId);
                                                if (!context) return null;
                                                return (
                                                    <button
                                                        key={contextId}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onContextClick(contextId);
                                                        }}
                                                        className="px-2 py-0.5 rounded text-xs bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 transition-colors"
                                                        title={context.name}
                                                    >
                                                        {context.name}
                                                    </button>
                                                );
                                            })}
                                            {file.contexts.length > 2 && (
                                                <span className="text-xs text-[var(--text-tertiary)]">
                                                    +{file.contexts.length - 2}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-xs text-[var(--text-tertiary)]">-</span>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default FileList;
