import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../../contexts/AppStateContext';

// Layout Components
import AppHeader from './AppHeader';

// Page Components
import SmartExplorer from '../pages/SmartExplorer';
import ChatInterface from '../pages/ChatInterface';
import NoteTaking from '../pages/NoteTaking';
import KanbanTaskManagement from '../pages/KanbanTaskManagement';
import Profile from '../pages/Profile';
import PageLoader from '../ui/PageLoader';

// Modal Components
import Settings from '../pages/Settings';
import AuthOverlay from '../ui/AuthOverlay';
import OllamaSetup from '../ui/OllamaSetup';

const getApiBaseUrl = () => window.API_CONFIG ? `http://127.0.0.1:${window.API_CONFIG.port}` : 'http://127.0.0.1:8000';
const getHeaders = (extra = {}) => ({
    ...(window.API_CONFIG ? { 'Authorization': `Bearer ${window.API_CONFIG.token}` } : {}),
    ...extra
});

const GlobalLayout = () => {
    const { state, setOllamaStatus } = useAppState();
    const [isPageLoading, setIsPageLoading] = useState(false);

    useEffect(() => {
        setIsPageLoading(true);
        const timer = setTimeout(() => setIsPageLoading(false), 400);
        return () => clearTimeout(timer);
    }, [state.activeSection]);

    useEffect(() => {
        const userId = state.user?.uid || 'default';

        const checkHealth = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            try {
                const res = await fetch(`${getApiBaseUrl()}/health?userId=${userId}`, { 
                    signal: controller.signal,
                    headers: getHeaders()
                });
                const data = await res.json();
                clearTimeout(timeoutId);
                if (data.ollama?.flaw === 'Models missing') {
                    setOllamaStatus('missing_model');
                } else if (data.ollama?.running || data.ollama?.active) {
                    setOllamaStatus('running');
                } else {
                    setOllamaStatus('stopped');
                }
            } catch (err) {
                clearTimeout(timeoutId);
                setOllamaStatus('offline');
            }
        };

        checkHealth();
        const interval = setInterval(checkHealth, 10000);
        return () => {
            clearInterval(interval);
        };
    }, [state.user?.uid, setOllamaStatus]);

    if (!state.user) {
        return <AuthOverlay isMandatory={true} />;
    }

    return (
        <div className={`w-full h-screen flex flex-col overflow-hidden font-inter transition-colors duration-500 ${
            state.settings.theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'
        } ${
            state.settings.fontSize === 'small' ? 'text-xs' : 
            state.settings.fontSize === 'large' ? 'text-lg' : 'text-base'
        }`}>
            <AppHeader />

            <div className="flex-1 flex min-h-0 bg-white">
                <main className="flex-1 min-w-0 p-6 overflow-hidden relative bg-slate-50/30">
                    <div className="h-full w-full max-w-[1700px] mx-auto relative z-10 bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                        
                        {/* Global Page Loader Overlay */}
                        <AnimatePresence>
                            {isPageLoading && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center"
                                >
                                    <PageLoader message={`Switching to ${state.activeSection}...`} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Persistent Page Layers */}
                        <div className="relative h-full w-full">
                            <div className={`absolute inset-0 transition-all duration-500 ${state.activeSection === 'explorer' ? 'opacity-100 z-10 translate-y-0' : 'opacity-0 z-0 translate-y-4 pointer-events-none'}`}>
                                <SmartExplorer />
                            </div>
                            <div className={`absolute inset-0 transition-all duration-500 ${state.activeSection === 'notes' ? 'opacity-100 z-10 translate-y-0' : 'opacity-0 z-0 translate-y-4 pointer-events-none'}`}>
                                <NoteTaking />
                            </div>
                            <div className={`absolute inset-0 transition-all duration-500 ${state.activeSection === 'tasks' ? 'opacity-100 z-10 translate-y-0' : 'opacity-0 z-0 translate-y-4 pointer-events-none'}`}>
                                <KanbanTaskManagement />
                            </div>
                            <div className={`absolute inset-0 transition-all duration-500 ${state.activeSection === 'chat' ? 'opacity-100 z-10 translate-y-0' : 'opacity-0 z-0 translate-y-4 pointer-events-none'}`}>
                                <ChatInterface />
                            </div>
                            <div className={`absolute inset-0 transition-all duration-500 ${state.activeSection === 'profile' ? 'opacity-100 z-10 translate-y-0' : 'opacity-0 z-0 translate-y-4 pointer-events-none'}`}>
                                <Profile />
                            </div>
                        </div>

                    </div>
                </main>
            </div>

            {/* Global Modals */}
            <Settings />
            {state.showAuth && <AuthOverlay />}
            <OllamaSetup />
        </div>
    );
};

export default GlobalLayout;
