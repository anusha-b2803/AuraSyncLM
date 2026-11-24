import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MENTION_TYPES } from '../../utils/constants';

const MentionInput = ({ files = [], contexts = [], isOnline, onSend, placeholder = 'Type a message...' }) => {
    const [input, setInput] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [mentionType, setMentionType] = useState(null);
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef(null);

    // Detect @ mentions
    useEffect(() => {
        const lastAtIndex = input.lastIndexOf('@', cursorPosition);

        if (lastAtIndex !== -1 && lastAtIndex < cursorPosition) {
            const query = input.slice(lastAtIndex + 1, cursorPosition).toLowerCase();

            // Filter suggestions based on query
            let filtered = [];

            // File mentions
            const fileMatches = files
                .filter(f => f.name.toLowerCase().includes(query))
                .map(f => ({ type: MENTION_TYPES.FILE, value: f.name, id: f.id }));

            // Context mentions
            const contextMatches = contexts
                .filter(c => c.name.toLowerCase().includes(query))
                .map(c => ({ type: MENTION_TYPES.CONTEXT, value: c.name, id: c.id, color: c.color }));

            // Chatbot mention (only if online)
            if (isOnline && 'onlinechatbot'.includes(query)) {
                filtered.push({ type: MENTION_TYPES.CHATBOT, value: 'onlinechatbot', id: 'chatbot' });
            }

            filtered = [...fileMatches, ...contextMatches, ...filtered];

            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setShowSuggestions(false);
        }
    }, [input, cursorPosition, files, contexts, isOnline]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = () => {
        if (input.trim() && onSend) {
            onSend(input);
            setInput('');
        }
    };

    const insertMention = (suggestion) => {
        const lastAtIndex = input.lastIndexOf('@', cursorPosition);
        const before = input.slice(0, lastAtIndex);
        const after = input.slice(cursorPosition);
        const newInput = `${before}@${suggestion.value} ${after}`;
        setInput(newInput);
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const getMentionColor = (type) => {
        switch (type) {
            case MENTION_TYPES.FILE:
                return '#3b82f6'; // Blue
            case MENTION_TYPES.CONTEXT:
                return '#8b5cf6'; // Purple
            case MENTION_TYPES.CHATBOT:
                return '#10b981'; // Green
            default:
                return '#6b7280';
        }
    };

    return (
        <div className="relative">
            {/* Suggestions dropdown */}
            <AnimatePresence>
                {showSuggestions && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-0 right-0 mb-2 glass-strong rounded-lg shadow-lg max-h-48 overflow-y-auto custom-scrollbar"
                    >
                        {suggestions.map((suggestion, index) => (
                            <div
                                key={`${suggestion.type}-${suggestion.id}-${index}`}
                                onClick={() => insertMention(suggestion)}
                                className="px-3 py-2 hover:bg-[var(--bg-tertiary)] cursor-pointer flex items-center gap-2"
                            >
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: suggestion.color || getMentionColor(suggestion.type) }}
                                />
                                <span className="text-sm text-[var(--text-primary)]">@{suggestion.value}</span>
                                <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                                    {suggestion.type}
                                </span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input field */}
            <div className="flex items-end gap-2">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                        setCursorPosition(e.target.selectionStart);
                    }}
                    onKeyDown={handleKeyDown}
                    onSelect={(e) => setCursorPosition(e.target.selectionStart)}
                    placeholder={placeholder}
                    rows={1}
                    className="
            flex-1 px-4 py-3
            glass border border-[var(--border-color)]
            rounded-lg resize-none
            text-sm text-[var(--text-primary)]
            placeholder:text-[var(--text-tertiary)]
            focus:outline-none focus:border-primary-500
            transition-colors
            custom-scrollbar
          "
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                />
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="
            px-4 py-3
            bg-primary-500 text-white
            rounded-lg font-medium text-sm
            disabled:opacity-50 disabled:cursor-not-allowed
            hover:bg-primary-600
            transition-colors
          "
                >
                    Send
                </motion.button>
            </div>
        </div>
    );
};

export default MentionInput;
