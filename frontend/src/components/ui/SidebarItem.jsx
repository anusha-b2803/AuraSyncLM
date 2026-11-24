import React from 'react';

const SidebarItem = ({ icon, label, onClick, active = false }) => {
    return (
        <button
            onClick={onClick}
            className={`
                w-full px-5 py-4 rounded-2xl flex items-center gap-4
                text-left transition-all font-black text-xs uppercase tracking-widest
                ${active
                    ? 'bg-white text-violet-700 shadow-lg scale-[1.02]'
                    : 'text-violet-200 hover:bg-white/10 hover:text-white'
                }
            `}
        >
            <span className="text-lg opacity-80">{icon}</span>
            <span>{label}</span>
        </button>
    );
};

export default SidebarItem;
