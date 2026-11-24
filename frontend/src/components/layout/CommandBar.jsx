import React, { useState } from 'react';

import GlassPanel from '../ui/GlassPanel';
import ThemeSwitcher from '../ui/ThemeSwitcher';
import { useAppState } from '../../contexts/AppStateContext';

const CommandBar = () => {
    const { state, toggleOnline, toggleProfile } = useAppState();
    const [searchExpanded, setSearchExpanded] = useState(false);

    return (
        <GlassPanel className="flex items-center justify-between px-6 py-3">
            {/* Left: Search */}
            <div className="flex items-center gap-4 flex-1">
                <div className="relative w-[250px] focus-within:w-[400px]">
                    <input
                        type="text"
                        placeholder="Search files, contexts... (⌘K)"
                        onFocus={() => setSearchExpanded(true)}
                        onBlur={() => setSearchExpanded(false)}
                        className="
              w-full px-4 py-2 pl-10
              glass border border-[var(--border-color)]
              rounded-lg text-sm
              text-[var(--text-primary)]
              placeholder:text-[var(--text-tertiary)]
              focus:outline-none focus:border-primary-500
            "
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                        🔍
                    </span>
                </div>

                <span className="text-xs text-[var(--text-tertiary)] px-2 py-1 glass rounded">
                    ⌘K
                </span>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-4">
                {/* Online/Offline Indicator */}
                <button
                    onClick={toggleOnline}
                    className={`
            flex items-center gap-2 px-3 py-2
            rounded-lg text-sm font-medium
            cursor-pointer
            ${state.isOnline
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }
          `}
                    title={state.isOnline ? 'Online' : 'Offline'}
                >
                    <div
                        className={`w-2 h-2 rounded-full ${state.isOnline ? 'bg-green-400' : 'bg-gray-400'}`}
                    />
                    <span>{state.isOnline ? 'Online' : 'Offline'}</span>
                </button>

                {/* Theme Switcher */}
                <ThemeSwitcher />

                {/* User Avatar */}
                <div
                    onClick={toggleProfile}
                    className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-sm cursor-pointer overflow-hidden"
                    title={`${state.userProfile.name} - Click to view profile`}
                >
                    {state.userProfile.avatar ? (
                        <img
                            src={state.userProfile.avatar}
                            alt={state.userProfile.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        state.userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U'
                    )}
                </div>
            </div>
        </GlassPanel>
    );
};

export default CommandBar;
