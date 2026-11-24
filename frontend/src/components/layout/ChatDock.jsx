import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassPanel from '../ui/GlassPanel';
import ChatBubble from '../ui/ChatBubble';
import MentionInput from '../ui/MentionInput';
import TaskManagement from '../chat/TaskManagement';
import NoteTaking from '../chat/NoteTaking';
import { useAppState } from '../../contexts/AppStateContext';

const API_BASE_URL = window.API_CONFIG ? `http://127.0.0.1:${window.API_CONFIG.port}` : 'http://127.0.0.1:8000';
const getHeaders = (extra = {}) => ({
    ...(window.API_CONFIG ? { 'Authorization': `Bearer ${window.API_CONFIG.token}` } : {}),
    ...extra
});

const ChatDock = () => {
    const { state, setActiveChatTab } = useAppState();
    const [messages, setMessages] = useState([
        {
            id: 1,
            message: 'Welcome to AuraSync LM! I am your adaptive intelligence hub. How can I assist you today?',
            isUser: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
    ]);
    const [isExpanded, setIsExpanded] = useState(false);

    const handleSendMessage = (message) => {
        const newMessage = {
            id: messages.length + 1,
            message,
            isUser: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages([...messages, newMessage]);

        // Real AI backend integration
        const getAIResponse = async () => {
            const assistantId = Date.now();
            const initialAssistantMessage = {
                id: assistantId,
                message: '',
                isUser: false,
                isStreaming: true,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };

            setMessages((prev) => [...prev, initialAssistantMessage]);

            try {
                const userId = state.user?.uid || 'default';
                const res = await fetch(`${API_BASE_URL}/chat`, {
                    method: 'POST',
                    headers: getHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ 
                        query: message,
                        userId: userId 
                    }),
                });

                if (!res.ok) throw new Error('Backend offline');

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let fullText = '';
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const data = JSON.parse(line);
                            if (data.type === 'token') {
                                fullText += data.token;
                                setMessages((prev) => 
                                    prev.map(m => m.id === assistantId ? { ...m, message: fullText } : m)
                                );
                            } else if (data.type === 'done') {
                                setMessages((prev) => 
                                    prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m)
                                );
                            }
                        } catch (e) {
                            console.error('Error parsing stream token:', e);
                        }
                    }
                }
            } catch (error) {
                setMessages((prev) => 
                    prev.map(m => m.id === assistantId ? { 
                        ...m, 
                        message: '⚠️ Connection lost. Please ensure the AuraSync backend is running.',
                        isStreaming: false 
                    } : m)
                );
            }
        };

        getAIResponse();
    };

    const tabs = [
        { id: 'chat', label: 'Chat', icon: '💬' },
        { id: 'tasks', label: 'Tasks', icon: '📋' },
        { id: 'notes', label: 'Notes', icon: '📝' },
    ];

    const renderTabContent = () => {
        switch (state.activeChatTab) {
            case 'chat':
                return (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                            {messages.map((msg) => (
                                <ChatBubble
                                    key={msg.id}
                                    message={msg.message}
                                    isUser={msg.isUser}
                                    timestamp={msg.timestamp}
                                />
                            ))}
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-[var(--border-color)]">
                            {state.isOnline ? (
                                <MentionInput
                                    files={state.files}
                                    contexts={state.contexts}
                                    isOnline={state.isOnline}
                                    onSend={handleSendMessage}
                                    placeholder="Type a message... Use @ to mention files or contexts"
                                />
                            ) : (
                                <div className="text-center py-4 text-sm text-[var(--text-tertiary)]">
                                    <p>💡 Go online to enable AI chat</p>
                                    <p className="text-xs mt-1">Click the status indicator in the top bar</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'tasks':
                return <TaskManagement />;
            case 'notes':
                return <NoteTaking />;
            default:
                return null;
        }
    };

    return (
        <motion.div
            animate={{ height: isExpanded ? '500px' : '60px' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative"
        >
            <GlassPanel className="h-full flex flex-col">
                {/* Header with Tabs */}
                <div className="flex items-center justify-between border-b border-[var(--border-color)]">
                    {/* Tabs */}
                    <div className="flex items-center">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveChatTab(tab.id);
                                    if (!isExpanded) setIsExpanded(true);
                                }}
                                className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-all relative ${state.activeChatTab === tab.id
                                        ? 'text-primary-400'
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                <span className="text-lg">{tab.icon}</span>
                                <span>{tab.label}</span>
                                {state.activeChatTab === tab.id && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Expand/Collapse Button */}
                    <motion.button
                        onClick={() => setIsExpanded(!isExpanded)}
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-4 text-xl text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                        ▼
                    </motion.button>
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    {isExpanded && (
                        <motion.div
                            key={state.activeChatTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="flex-1 overflow-hidden"
                        >
                            {renderTabContent()}
                        </motion.div>
                    )}
                </AnimatePresence>
            </GlassPanel>
        </motion.div>
    );
};

export default ChatDock;
