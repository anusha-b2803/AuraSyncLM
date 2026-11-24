import React from 'react';
import SidebarItem from '../ui/SidebarItem';
import { useAppState } from '../../contexts/AppStateContext';

const Sidebar = () => {
    const { state, setActiveSection, toggleSettings } = useAppState();

    const sections = [
        { id: 'explorer', icon: '📂', label: 'Library' },
        { id: 'notes', icon: '📝', label: 'Notes' },
        { id: 'tasks', icon: '✅', label: 'Planner' },
        { id: 'chat', icon: '💬', label: 'Study AI' },
    ];

    return (
        <aside className="w-72 h-full flex flex-col bg-violet-700 backdrop-blur-2xl border-r border-violet-800 p-8 shadow-2xl z-20">
            <div className="flex-1 space-y-4">
                <p className="text-[10px] font-black text-violet-300 uppercase tracking-[0.2em] px-4 mb-6">Workspace</p>
                {sections.map((section) => (
                    <SidebarItem
                        key={section.id}
                        icon={section.icon}
                        label={section.label}
                        onClick={() => setActiveSection(section.id)}
                        active={state.activeSection === section.id}
                    />
                ))}
            </div>

            <div className="mt-auto pt-8 border-t border-violet-800/50">
                <SidebarItem
                    icon="⚙️"
                    label="Settings"
                    onClick={toggleSettings}
                />
            </div>
        </aside>
    );
};

export default Sidebar;
