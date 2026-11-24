import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../../contexts/AppStateContext';

const Settings = () => {
    const { state, updateSettings, toggleSettings, toggleProfile } = useAppState();
    const [localSettings, setLocalSettings] = useState({
        ...state.settings,
        notifications: true,
        notificationSound: true,
        fontSize: 'medium',
        enableAnimations: true
    });
    const [activeTab, setActiveTab] = useState('account');

    if (!state.showSettings) return null;

    const handleSave = () => {
        updateSettings(localSettings);
        toggleSettings();
    };

    const updateSetting = (key, value) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
    };

    const tabs = [
        { id: 'account', label: 'Identity', icon: '👤' },
        { id: 'appearance', label: 'Aesthetics', icon: '🎨' },
        { id: 'notifications', label: 'Signals', icon: '🔔' },
        { id: 'about', label: 'Intelligence', icon: 'ℹ️' },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'account':
                return (
                    <div className="space-y-6">
                        <div className="p-10 bg-white rounded-[40px] border border-slate-100 text-center shadow-sm">
                            <div className="w-24 h-24 bg-violet-600 text-white rounded-3xl flex items-center justify-center text-4xl font-black mx-auto mb-6 shadow-xl shadow-violet-100">
                                {state.user?.displayName?.[0] || 'U'}
                            </div>
                            <h4 className="text-2xl font-black text-slate-900 tracking-tight">{state.user?.displayName || 'Research Identity'}</h4>
                            <p className="text-[10px] text-slate-400 mt-2 font-black uppercase tracking-[0.2em]">Neural Node: {state.user?.email}</p>
                            
                            <div className="mt-10 flex gap-4 justify-center">
                                <button 
                                    onClick={() => { toggleSettings(); toggleProfile(); }}
                                    className="px-8 py-3 bg-slate-50 text-slate-600 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:border-violet-200 transition-all shadow-sm"
                                >
                                    Modify Profile
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case 'appearance':
                return (
                    <div className="space-y-8">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Focus Scale (Font Size)</label>
                            <div className="flex items-center gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                                <span className="text-xs text-slate-400 font-black">A</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="1"
                                    value={localSettings.fontSize === 'small' ? 0 : localSettings.fontSize === 'medium' ? 1 : 2}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        updateSetting('fontSize', val === 0 ? 'small' : val === 1 ? 'medium' : 'large');
                                    }}
                                    className="flex-1 accent-violet-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-2xl text-slate-900 font-black">A</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm">
                            <div>
                                <label className="block text-xs font-black text-slate-900 uppercase tracking-tight">Dark Mode</label>
                                <p className="text-[10px] text-slate-400 mt-1 font-bold">Switch to neural-dark interface</p>
                            </div>
                            <button 
                                onClick={() => updateSetting('theme', localSettings.theme === 'dark' ? 'light' : 'dark')}
                                className={`w-12 h-7 rounded-full transition-all relative ${localSettings.theme === 'dark' ? 'bg-violet-600 shadow-lg shadow-violet-100' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-1.5 w-4 h-4 bg-white rounded-full transition-all ${localSettings.theme === 'dark' ? 'left-6' : 'left-2'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm">
                            <div>
                                <label className="block text-xs font-black text-slate-900 uppercase tracking-tight">Fluid Motion</label>
                                <p className="text-[10px] text-slate-400 mt-1 font-bold">Enable premium interface transitions</p>
                            </div>
                            <button 
                                onClick={() => updateSetting('enableAnimations', !localSettings.enableAnimations)}
                                className={`w-12 h-7 rounded-full transition-all relative ${localSettings.enableAnimations ? 'bg-violet-600 shadow-lg shadow-violet-100' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-1.5 w-4 h-4 bg-white rounded-full transition-all ${localSettings.enableAnimations ? 'left-6' : 'left-2'}`} />
                            </button>
                        </div>
                    </div>
                );

            case 'notifications':
                return (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm">
                            <div>
                                <label className="block text-xs font-black text-slate-900 uppercase tracking-tight">Neural Alerts</label>
                                <p className="text-[10px] text-slate-400 mt-1 font-bold">Show desktop notifications for tasks</p>
                            </div>
                            <button 
                                onClick={() => updateSetting('notifications', !localSettings.notifications)}
                                className={`w-12 h-7 rounded-full transition-all relative ${localSettings.notifications ? 'bg-violet-600 shadow-lg shadow-violet-100' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-1.5 w-4 h-4 bg-white rounded-full transition-all ${localSettings.notifications ? 'left-6' : 'left-2'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm">
                            <div>
                                <label className="block text-xs font-black text-slate-900 uppercase tracking-tight">Sonic Feedback</label>
                                <p className="text-[10px] text-slate-400 mt-1 font-bold">Play subtle sounds for system events</p>
                            </div>
                            <button 
                                onClick={() => updateSetting('notificationSound', !localSettings.notificationSound)}
                                className={`w-12 h-7 rounded-full transition-all relative ${localSettings.notificationSound ? 'bg-violet-600 shadow-lg shadow-violet-100' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-1.5 w-4 h-4 bg-white rounded-full transition-all ${localSettings.notificationSound ? 'left-6' : 'left-2'}`} />
                            </button>
                        </div>
                    </div>
                );

            case 'about':
                return (
                    <div className="space-y-6">
                        <div className="p-10 bg-white rounded-[40px] border border-slate-100 text-center shadow-sm">
                            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-3xl font-bold mx-auto mb-6 border border-slate-100 shadow-sm">
                                🚀
                            </div>
                            <h4 className="text-xl font-black text-slate-900 tracking-tight">AuraSync <span className="text-violet-600">Intelligence Hub</span></h4>
                            <p className="text-[10px] text-slate-400 mt-2 font-black uppercase tracking-[0.3em]">Quantum Release 1.0.0</p>
                            
                            <div className="mt-10 pt-8 border-t border-slate-100 text-left space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Environment</span>
                                    <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Local Neural Interface</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Engine</span>
                                    <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Ollama Multi-Model</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Privacy</span>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Air-Gapped Secure</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/20 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[48px] w-full max-w-4xl h-[700px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="px-12 py-10 flex items-center justify-between border-b border-slate-50">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Preferences</h2>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">Fine-tune your cognitive workspace</p>
                    </div>
                    <button onClick={toggleSettings} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-300 hover:text-slate-900 transition-all hover:bg-slate-100">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 flex min-h-0 bg-slate-50/50">
                    {/* Navigation Sidebar */}
                    <div className="w-64 p-8 flex flex-col gap-3 border-r border-slate-100 bg-white">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-violet-600 text-white shadow-xl shadow-violet-100 scale-[1.02]' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                            >
                                <span className="text-xl">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                {renderTabContent()}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-12 py-8 bg-white border-t border-slate-100 flex gap-4 justify-end">
                    <button
                        onClick={toggleSettings}
                        className="px-10 py-4 text-slate-400 text-[11px] font-black uppercase tracking-[0.2em] hover:text-slate-900 transition-all"
                    >
                        Dismiss
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-12 py-4 bg-violet-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-violet-700 transition-all shadow-xl shadow-violet-100"
                    >
                        Apply Changes
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default Settings;
