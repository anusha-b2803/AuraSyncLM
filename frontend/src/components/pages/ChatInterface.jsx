import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAppState } from '../../contexts/AppStateContext';

const getApiBaseUrl = () => window.API_CONFIG ? `http://127.0.0.1:${window.API_CONFIG.port}` : 'http://127.0.0.1:8000';
const getHeaders = (extra = {}) => ({
    ...(window.API_CONFIG ? { 'Authorization': `Bearer ${window.API_CONFIG.token}` } : {}),
    ...extra
});
const SESSIONS_STORAGE_KEY = 'aurasync_chat_sessions';

const INITIAL_MESSAGE = {
    id: '1',
    type: 'assistant',
    content: 'Hello! I am AuraSync Intelligence. Ask me anything about your research documents and I will provide cited answers from your library.',
    timestamp: new Date().toISOString(),
};

const ChatInterface = () => {
    const appState = useAppState();
    const { state, toggleProfile } = appState;
    const abortControllerRef = useRef(null);
    const userId = state.user?.uid || 'default';
    const sessionsKey = `aurasync_chat_sessions_${userId}`;
    
    // Sessions state
    const [sessions, setSessions] = useState(() => {
        try {
            const saved = localStorage.getItem(sessionsKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.length > 0 ? parsed : [{ id: 'default', title: 'Research Session', messages: [INITIAL_MESSAGE] }];
            }
            return [{ id: 'default', title: 'Research Session', messages: [INITIAL_MESSAGE] }];
        } catch {
            return [{ id: 'default', title: 'Research Session', messages: [INITIAL_MESSAGE] }];
        }
    });

    // Reload sessions when user changes
    useEffect(() => {
        const saved = localStorage.getItem(sessionsKey);
        if (saved) {
            setSessions(JSON.parse(saved));
        } else {
            setSessions([{ id: 'default', title: 'Research Session', messages: [INITIAL_MESSAGE] }]);
        }
    }, [userId]);

    const [activeSessionId, setActiveSessionId] = useState(sessions[0].id);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [indexStatus, setIndexStatus] = useState('unknown');
    const [scanProgress, setScanProgress] = useState('');
    const [retrievalMode, setRetrievalMode] = useState('mmlf'); // 'mmlf' (NAACL 2025) or 'standard'
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const textareaRef = useRef(null);
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

    const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
    const messages = activeSession.messages;

    // Persist sessions
    useEffect(() => {
        localStorage.setItem(sessionsKey, JSON.stringify(sessions));
    }, [sessions, sessionsKey]);

    // Auto-scroll logic
    useEffect(() => {
        if (autoScrollEnabled && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            container.scrollTop = container.scrollHeight;
        }
    }, [sessions, autoScrollEnabled]);

    // Detect user scroll to enable/disable auto-scroll
    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Check if user is within 150px of the bottom
        const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
        
        if (isNearBottom) {
            if (!autoScrollEnabled) setAutoScrollEnabled(true);
        } else {
            if (autoScrollEnabled) setAutoScrollEnabled(false);
        }
    };

    // Check index status
    useEffect(() => {
        fetch(`${getApiBaseUrl()}/health?userId=${userId}`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => setIndexStatus(data.index_ready ? 'ready' : 'empty'))
            .catch(() => setIndexStatus('unknown'));
    }, [userId]);

    const createNewSession = () => {
        const newSession = {
            id: Date.now().toString(),
            title: `New Research ${sessions.length + 1}`,
            messages: [INITIAL_MESSAGE]
        };
        setSessions([newSession, ...sessions]);
        setActiveSessionId(newSession.id);
    };

    const deleteSession = (id, e) => {
        e.stopPropagation();
        if (sessions.length === 1) {
            setSessions([{ id: 'default', title: 'Research Session', messages: [INITIAL_MESSAGE] }]);
            setActiveSessionId('default');
            return;
        }
        const filtered = sessions.filter(s => s.id !== id);
        setSessions(filtered);
        if (activeSessionId === id) {
            setActiveSessionId(filtered[0].id);
        }
    };

    const handleSendMessage = async (content = null) => {
        const textToSend = typeof content === 'string' ? content : inputValue;
        const userMsgText = (textToSend || '').trim();
        if (!userMsgText || isLoading) return;

        const userMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: userMsgText,
            timestamp: new Date().toISOString(),
        };

        const assistantId = (Date.now() + 1).toString();
        const initialAssistantMessage = {
            id: assistantId,
            type: 'assistant',
            content: '',
            sources: [],
            isStreaming: true,
            timestamp: new Date().toISOString(),
        };

        setSessions(prev => prev.map(s => 
            s.id === activeSessionId ? { ...s, messages: [...s.messages, userMessage, initialAssistantMessage] } : s
        ));
        
        setInputValue('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        setIsLoading(true);
        setScanProgress("Retrieving Library Sources...");

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const historyForBackend = messages
            .filter(m => m.type !== 'system')
            .map(m => ({
                role: m.type === 'user' ? 'user' : 'assistant',
                content: m.content
            }))
            .slice(-10);

        try {
            const res = await fetch(`${getApiBaseUrl()}/chat`, {
                method: 'POST',
                headers: getHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ 
                    query: userMsgText, 
                    history: historyForBackend,
                    userId: userId,
                    retrievalMode: retrievalMode
                }),
                signal: abortControllerRef.current.signal
            });

            if (!res.ok) throw new Error('Research station offline');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let sources = [];
            let mmlfData = null;
            let buffer = ''; // Buffer for partial JSON lines
            let hasFirstToken = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Keep the last (potentially incomplete) line in the buffer
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        
                        if (data.type === 'mmlf_status') {
                            setScanProgress(data.message || 'Fusing Knowledge Perspectives...');
                        } else if (data.type === 'metadata') {
                            setScanProgress("Synthesizing Knowledge...");
                            sources = data.contexts || [];
                            mmlfData = data.mmlf || null;
                        } else if (data.type === 'token') {
                            if (!hasFirstToken) {
                                hasFirstToken = true;
                                setIsLoading(false);
                            }
                            fullText += data.token;
                            setSessions(prev => prev.map(s => 
                                s.id === activeSessionId ? {
                                    ...s,
                                    messages: s.messages.map(m => 
                                        m.id === assistantId ? { ...m, content: fullText, sources, mmlf: mmlfData } : m
                                    )
                                } : s
                            ));
                        } else if (data.type === 'done') {
                            let finalContent = fullText;
                            let followUps = [];
                            if (finalContent.includes('---FOLLOW_UPS---')) {
                                const parts = finalContent.split('---FOLLOW_UPS---');
                                finalContent = parts[0].trim();
                                followUps = parts[1].trim().split('\n')
                                    .map(q => q.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim())
                                    .filter(q => q.length > 5);
                            }

                            setSessions(prev => prev.map(s => 
                                s.id === activeSessionId ? {
                                    ...s,
                                    messages: s.messages.map(m => 
                                        m.id === assistantId ? { 
                                            ...m, 
                                            content: finalContent, 
                                            followUps, 
                                            sources,
                                            mmlf: mmlfData,
                                            isStreaming: false 
                                        } : m
                                    ),
                                    title: s.messages.length <= 2 ? userMsgText.slice(0, 30) + (userMsgText.length > 30 ? '...' : '') : s.title
                                } : s
                            ));
                        }
                    } catch (e) {
                        console.error('JSON parse error in stream:', e);
                    }
                }
            }
        } catch (err) {
            setSessions(prev => prev.map(s => 
                s.id === activeSessionId ? {
                    ...s,
                    messages: s.messages.map(m => 
                        m.id === assistantId ? { ...m, content: `⚠️ Error: ${err.message}`, isStreaming: false } : m
                    )
                } : s
            ));
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
            setSessions(prev => prev.map(s => 
                s.id === activeSessionId ? {
                    ...s,
                    messages: s.messages.map(m => 
                        m.isStreaming ? { ...m, isStreaming: false } : m
                    )
                } : s
            ));
        }
    };

    const renderMessageContent = (content, isStreaming = false, isUser = false) => {
        if (content === '' && isStreaming) {
            return (
                <div className="flex items-center gap-2 text-violet-400 font-bold animate-pulse text-[11px] uppercase tracking-widest py-2">
                    <span className="w-2 h-2 bg-violet-400 rounded-full"></span>
                    Neural Synthesis...
                </div>
            );
        }

        const textColor = isUser ? 'text-white' : 'text-slate-700';
        const headingColor = isUser ? 'text-white' : 'text-slate-900';
        const codeBg = isUser ? 'bg-violet-500/30 border-violet-400/30 text-white' : 'bg-violet-50 text-violet-700 border-violet-100';

        return (
            <div className={`markdown-content ${isUser ? 'text-white/90' : 'text-slate-700'}`}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                        code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                                <div className="my-4 rounded-xl overflow-hidden shadow-2xl">
                                    <div className="bg-[#1e1e1e] px-4 py-2 flex justify-between items-center border-b border-white/5">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{match[1]}</span>
                                        <button 
                                            onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
                                            className="text-[9px] font-bold text-slate-500 hover:text-white transition-colors"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        className="!m-0 !bg-[#1e1e1e] !p-4 !text-xs"
                                        {...props}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                </div>
                            ) : (
                                <code className={`${codeBg} px-1.5 py-0.5 rounded-md font-mono text-xs font-bold border`} {...props}>
                                    {children}
                                </code>
                            );
                        },
                        h2: ({ children }) => <h2 className={`text-lg font-black ${headingColor} mt-6 mb-3 tracking-tight`}>{children}</h2>,
                        h3: ({ children }) => <h3 className={`text-base font-bold ${headingColor} mt-5 mb-2`}>{children}</h3>,
                        p: ({ children }) => <p className={`mb-4 leading-relaxed ${isUser ? 'text-white' : 'text-slate-700'}`}>{children}</p>,
                        ul: ({ children }) => <ul className="list-disc ml-6 mb-4 space-y-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 space-y-2">{children}</ol>,
                        li: ({ children }) => <li className={isUser ? 'text-white' : 'text-slate-700'}>{children}</li>,
                        blockquote: ({ children }) => <blockquote className={`border-l-4 ${isUser ? 'border-white/30 bg-white/10' : 'border-violet-200 bg-violet-50/30'} pl-4 py-1 italic my-4 rounded-r-lg`}>{children}</blockquote>,
                        table: ({ children }) => (
                            <div className={`overflow-x-auto my-6 rounded-xl border ${isUser ? 'border-white/20' : 'border-slate-100'} shadow-sm`}>
                                <table className="w-full text-sm text-left">{children}</table>
                            </div>
                        ),
                        thead: ({ children }) => <thead className={`${isUser ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-500'} text-[10px] font-black uppercase tracking-widest border-b ${isUser ? 'border-white/10' : 'border-slate-100'}`}>{children}</thead>,
                        th: ({ children }) => <th className="px-6 py-3">{children}</th>,
                        td: ({ children }) => <td className={`px-6 py-4 border-t ${isUser ? 'border-white/10 text-white/80' : 'border-slate-50 text-slate-600'}`}>{children}</td>,
                    }}
                >
                    {content}
                </ReactMarkdown>
                {isStreaming && (
                    <span className={`inline-block w-2 h-4 ${isUser ? 'bg-white' : 'bg-violet-500'} ml-0.5 animate-pulse rounded-sm align-middle`} />
                )}
            </div>
        );
    };

    return (
        <div className="h-full flex bg-[#f8fafc]">
            {/* Sidebar - Chat History */}
            <div className="w-72 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-6">
                    <button 
                        onClick={createNewSession}
                        className="w-full py-3 px-4 bg-violet-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-100 flex items-center justify-center gap-2"
                    >
                        <span>+</span> New Research
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Recent Intelligence</p>
                    {sessions.map(s => (
                        <div 
                            key={s.id}
                            onClick={() => setActiveSessionId(s.id)}
                            className={`group relative flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${
                                activeSessionId === s.id ? 'bg-violet-50 border-violet-100 text-violet-700 shadow-sm' : 'border-transparent text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-lg opacity-40">💬</span>
                                <span className="text-[11px] font-bold truncate">{s.title}</span>
                            </div>
                            <button 
                                onClick={(e) => deleteSession(s.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all text-slate-400"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
                <div className="p-6 border-t border-slate-100">
                    <div 
                        className="p-4 bg-slate-50/50 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition-all group"
                        onClick={toggleProfile}
                    >
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xs shadow-sm group-hover:scale-110 transition-transform overflow-hidden">
                            {state.userProfile?.avatar ? (
                                <img src={state.userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                (state.userProfile?.name || 'U').charAt(0).toUpperCase()
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-slate-900 uppercase truncate">
                                {state.userProfile?.name || 'Local Researcher'}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold">
                                {state.userProfile?.email || 'Offline Intelligence'}
                            </p>
                        </div>
                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="px-10 py-6 bg-white border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tighter">
                            {activeSession.title}
                        </h2>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                                Neural Engine Active
                            </p>
                            <div className="h-3 w-[1px] bg-slate-200 mx-1"></div>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full">
                                <span className="text-[10px]">🔒</span>
                                <span className="text-[8px] font-black text-emerald-700 uppercase tracking-wider">100% Offline</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div 
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar"
                >
                    {indexStatus === 'empty' && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-4">
                            <span className="text-2xl">💡</span>
                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                                Library not indexed. Go to <b>Library</b> tab and run a sync to enable document research.
                            </p>
                        </div>
                    )}

                    <AnimatePresence>
                        {messages.map((message) => (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[85%] rounded-[32px] px-8 py-6 shadow-sm border ${
                                    message.type === 'user'
                                    ? 'bg-violet-600 text-white border-violet-500'
                                    : 'bg-white text-slate-700 border-slate-100'
                                }`}>
                                    <div className="text-sm font-medium leading-relaxed">
                                        {renderMessageContent(message.content, message.isStreaming, message.type === 'user')}
                                    </div>
                                    
                                    {/* MMLF Perspectives Panel (NAACL 2025) */}
                                    {message.mmlf && message.mmlf.active && message.mmlf.subqueries && (
                                        <div className="mt-5 p-3.5 bg-violet-50/80 border border-violet-100 rounded-2xl">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs">🧠</span>
                                                <span className="text-[10px] font-black text-violet-800 uppercase tracking-wider">
                                                    MMLF Neural Fusion (NAACL 2025) • 3 Perspectives
                                                </span>
                                                <span className="text-[8px] bg-violet-200/70 text-violet-800 font-bold px-1.5 py-0.5 rounded-full ml-auto">
                                                    RRF k=60
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                {message.mmlf.subqueries.map((sq, sqIdx) => (
                                                    <div key={sqIdx} className="flex items-start gap-2 text-[10px] text-slate-700 bg-white/90 px-2.5 py-1.5 rounded-xl border border-violet-100/60 shadow-xs">
                                                        <span className="font-bold text-violet-600 shrink-0">#{sqIdx + 1}</span>
                                                        <span className="leading-snug">{sq}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Intelligent Sources / Citations */}
                                    {message.sources && message.sources.length > 0 && !message.content.includes("No relevant topic found in my knowledge base") && (
                                        <div className={`mt-5 pt-4 border-t ${message.type === 'user' ? 'border-white/10' : 'border-slate-100/80'}`}>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className={`w-1 h-3 rounded-full ${message.type === 'user' ? 'bg-white/40' : 'bg-violet-500'}`}></div>
                                                <p className={`text-[10px] font-black ${message.type === 'user' ? 'text-white/40' : 'text-slate-400'} uppercase tracking-[0.2em]`}>
                                                    {message.mmlf?.active ? "Fused Sources (RRF Ranked)" : "Intelligent Sources"}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {message.sources.map((s, idx) => (
                                                    <motion.div 
                                                        key={idx} 
                                                        whileHover={{ scale: 1.03 }}
                                                        className={`flex items-center gap-2.5 px-3.5 py-2 ${
                                                            message.type === 'user' 
                                                            ? 'bg-white/10 border-white/10 text-white' 
                                                            : 'bg-violet-50/50 border-violet-100 text-violet-700'
                                                        } border rounded-2xl shadow-xs backdrop-blur-sm transition-all cursor-default group`}
                                                    >
                                                        <span className="text-xs group-hover:rotate-12 transition-transform">
                                                            {s.file[0].endsWith('.pdf') ? '📕' : s.file[0].endsWith('.docx') ? '📘' : '📄'}
                                                        </span>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] font-black truncate max-w-[150px] leading-tight">{s.file[0]}</span>
                                                                {s.rrf_score ? (
                                                                    <span className="text-[7.5px] font-bold bg-violet-200/80 text-violet-800 px-1 py-0.2 rounded-sm">
                                                                        RRF #{s.final_rank || idx+1}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <span className={`text-[8px] font-bold ${message.type === 'user' ? 'text-white/40' : 'text-slate-400'} uppercase tracking-tighter`}>
                                                                {s.file[2] || 'General'} › {s.file[3] || 'Research'}
                                                            </span>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Follow-up Suggestions */}
                                    {message.followUps && message.followUps.length > 0 && (
                                        <div className="mt-6 flex flex-col gap-2">
                                            <p className={`text-[9px] font-black ${message.type === 'user' ? 'text-white/40' : 'text-violet-400'} uppercase tracking-[0.2em]`}>Next Questions</p>
                                            <div className="flex flex-wrap gap-2">
                                                {message.followUps.map((q, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            setInputValue(q);
                                                        }}
                                                        className={`px-4 py-2 ${message.type === 'user' ? 'bg-white/10 text-white border-white/20' : 'bg-violet-50 text-violet-700 border-violet-100'} border rounded-2xl text-[10px] font-bold hover:bg-violet-600 hover:text-white transition-all text-left`}
                                                    >
                                                        {q}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className={`mt-6 flex items-center justify-between ${message.type === 'user' ? 'text-violet-200' : 'text-slate-400'}`}>
                                        <span className="text-[9px] font-black uppercase tracking-widest">
                                            {message.type === 'user' ? 'You' : 'AuraSync Intelligence'}
                                        </span>
                                        <span className="text-[9px] font-bold opacity-60">
                                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-slate-100 rounded-[32px] px-8 py-6 flex gap-3 items-center shadow-sm">
                                <span className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-bounce" />
                                <span className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                                <span className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{scanProgress || "Reasoning..."}</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-8 bg-white border-t border-slate-100 relative">
                    {isLoading && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                            <button 
                                onClick={handleStopGeneration}
                                className="px-6 py-2 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 shadow-sm flex items-center gap-2"
                            >
                                <span className="w-2 h-2 bg-slate-400 rounded-sm"></span>
                                Stop Generating
                            </button>
                        </div>
                    )}
                    <div className="max-w-4xl mx-auto">
                        {/* Permanent Neural Engine Active Bar */}
                        <div className="flex items-center justify-between mb-3 px-2">
                            <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-600"></span>
                                </span>
                                <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest flex items-center gap-1.5">
                                    <span>🧠 Neural Engine Active</span>
                                    <span className="text-[8px] bg-violet-100 text-violet-700 font-bold px-1.5 py-0.5 rounded-full">MMLF SOTA</span>
                                </span>
                            </div>
                            <span className="text-[9px] font-semibold text-slate-400 hidden sm:inline">
                                3 Perspectives • CQE Expansion • RRF Late Fusion (NAACL 2025)
                            </span>
                        </div>

                        {/* Input Container */}
                        <div className="relative flex items-center">
                            <textarea
                                ref={textareaRef}
                                value={inputValue}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder="Ask a question about your research..."
                                rows={1}
                                className="w-full bg-slate-50 border border-slate-200/90 rounded-[28px] pl-6 pr-16 py-4.5 text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-300 transition-all resize-none shadow-inner min-h-[60px] leading-relaxed custom-scrollbar block"
                            />
                            <button
                                type="button"
                                onClick={() => handleSendMessage()}
                                disabled={isLoading || !inputValue.trim()}
                                className="absolute right-2.5 bottom-2.5 w-10 h-10 bg-violet-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-violet-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 disabled:hover:bg-violet-600 disabled:cursor-not-allowed shrink-0"
                                aria-label="Send message"
                                title="Send message"
                            >
                                <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest mt-6">
                        Secure Intelligence Engine · Multi-Source Retrieval · Powered by AuraSync
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
