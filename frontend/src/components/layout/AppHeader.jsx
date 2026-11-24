import React from 'react';
import { useAppState } from '../../contexts/AppStateContext';

const AppHeader = () => {
    const { state, setActiveSection, toggleAuth } = useAppState();

    const navItems = [
        { id: 'explorer', label: 'Library' },
        { id: 'notes', label: 'Notes' },
        { id: 'tasks', label: 'Planner' },
        { id: 'chat', label: 'Study AI' }
    ];

    return (
        <header className="h-16 bg-violet-700 border-b border-violet-800 flex items-center justify-between px-8 sticky top-0 z-50 shadow-md">
            {/* Logo */}
            <div 
                className="flex items-center gap-3 cursor-pointer group min-w-[180px]"
                onClick={() => setActiveSection('explorer')}
            >
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-violet-700 font-black shadow-lg group-hover:scale-105 transition-transform">
                    A
                </div>
                <h1 className="text-lg font-bold text-white tracking-tight">AuraSync <span className="text-violet-200">LM</span></h1>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-2 bg-violet-800/20 p-1.5 rounded-2xl">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                            state.activeSection === item.id 
                            ? 'bg-white text-violet-700 shadow-lg scale-105' 
                            : 'text-violet-100 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>

            {/* Profile Section */}
            <div className="flex items-center gap-6 min-w-[300px] justify-end">
                <div className="flex items-center gap-4">
                    {/* Status Dot */}
                    <div className={`w-2 h-2 rounded-full ${
                        state.ollamaStatus === 'running' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 
                        state.ollamaStatus === 'offline' ? 'bg-amber-400' : 'bg-rose-400'
                    }`}></div>
                    
                    {!state.user ? (
                        <button
                            onClick={toggleAuth}
                            className="px-6 py-2 bg-white text-violet-700 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-violet-50 transition-all shadow-md"
                        >
                            Sign In
                        </button>
                    ) : (
                        <button
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold transition-all overflow-hidden border-2 shadow-sm ${
                                state.activeSection === 'profile' ? 'border-white bg-white/30 scale-105 shadow-md' : 'border-white/10 bg-white/10 hover:bg-white/20'
                            }`}
                            onClick={() => setActiveSection('profile')}
                            title="Account Settings"
                        >
                            {state.userProfile?.avatar ? (
                                <img src={state.userProfile.avatar} alt="User" className="w-full h-full object-cover" />
                            ) : (
                                <span>{(state.userProfile?.name || state.user?.displayName || 'U').charAt(0).toUpperCase()}</span>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default AppHeader;
