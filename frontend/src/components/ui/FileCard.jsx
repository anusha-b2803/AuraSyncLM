import React from 'react';
import { motion } from 'framer-motion';
import ContextChip from './ContextChip';
import { FILE_TYPES } from '../../utils/constants';
import { useFavorites } from '../../hooks/useFavorites';
import { useAppState } from '../../contexts/AppStateContext';

const FileCard = ({ file, contexts, onFileClick, onContextClick }) => {
    const { isFavorite, toggleFavorite } = useFavorites();
    const { togglePin } = useAppState();

    const getFileIcon = (type) => {
        const icons = {
            [FILE_TYPES.PDF]: '📄',
            [FILE_TYPES.DOCX]: '📝',
            [FILE_TYPES.TXT]: '📃',
            [FILE_TYPES.IMAGE]: '🖼️',
            [FILE_TYPES.VIDEO]: '🎥',
            [FILE_TYPES.CODE]: '💻',
            [FILE_TYPES.OTHER]: '📋',
        };
        return icons[type] || icons[FILE_TYPES.OTHER];
    };

    const fileContexts = contexts.filter(ctx => file.contexts.includes(ctx.id));

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onFileClick(file)}
            className="
        relative group
        glass rounded-lg p-4
        cursor-pointer
        hover-glow click-compress
        transition-all duration-200
        border border-[var(--border-color)]
        hover:border-primary-500/50
      "
        >
            {/* Pinned indicator badge */}
            {file.pinned && (
                <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                >
                    📌 Pinned
                </motion.div>
            )}

            {/* File Icon */}
            <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">{getFileIcon(file.type)}</span>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {file.name}
                    </h3>
                    <p className="text-xs text-[var(--text-tertiary)]">{file.size}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1">
                    {/* Pin Button */}
                    <motion.button
                        whileHover={{ scale: 1.2, rotate: -15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            togglePin(file.id);
                        }}
                        className="text-lg hover:brightness-125 transition-all"
                        title={file.pinned ? 'Unpin file' : 'Pin file'}
                    >
                        <motion.span
                            animate={{
                                rotate: file.pinned ? [0, -15, 15, -15, 0] : 0,
                            }}
                            transition={{ duration: 0.5 }}
                        >
                            {file.pinned ? '📌' : '📍'}
                        </motion.span>
                    </motion.button>

                    {/* Favorite Button */}
                    <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(file.id);
                        }}
                        className="text-xl hover:brightness-125 transition-all"
                        title={isFavorite(file.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                    >
                        <motion.span
                            animate={{
                                rotate: isFavorite(file.id) ? [0, -10, 10, -10, 0] : 0,
                            }}
                            transition={{ duration: 0.5 }}
                        >
                            {isFavorite(file.id) ? '⭐' : '☆'}
                        </motion.span>
                    </motion.button>
                </div>
            </div>

            {/* Context Tags */}
            {fileContexts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {fileContexts.map((ctx) => (
                        <ContextChip
                            key={ctx.id}
                            name={ctx.name}
                            color={ctx.color}
                            onClick={(e) => {
                                e.stopPropagation();
                                onContextClick(ctx.id);
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Hover Actions */}
            <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-xs text-[var(--text-tertiary)] hover:text-primary-500">
                    Preview
                </button>
                <button className="text-xs text-[var(--text-tertiary)] hover:text-primary-500">
                    Open
                </button>
                <button className="text-xs text-[var(--text-tertiary)] hover:text-primary-500">
                    Share
                </button>
            </div>
        </motion.div>
    );
};

export default FileCard;
