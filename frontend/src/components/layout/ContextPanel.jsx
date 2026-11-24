import React, { useState } from 'react';
import { motion } from 'framer-motion';
import GlassPanel from '../ui/GlassPanel';
import { CONTEXT_PANEL_TABS, STUDY_MODE_TYPES, FILE_TYPES } from '../../utils/constants';
import { useContexts } from '../../hooks/useContexts';

const ContextPanel = () => {
    const [activeTab, setActiveTab] = useState(CONTEXT_PANEL_TABS.OVERVIEW);
    const { fileTypeFilter, setFileTypeFilter, filteredFiles } = useContexts();

    const tabs = [
        { id: CONTEXT_PANEL_TABS.OVERVIEW, label: 'Overview', icon: '📊' },
        { id: CONTEXT_PANEL_TABS.RELATED, label: 'Related', icon: '🔗' },
        { id: CONTEXT_PANEL_TABS.STUDY_MODE, label: 'Study', icon: '📚' },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case CONTEXT_PANEL_TABS.OVERVIEW:
                return (
                    <div className="space-y-4">
                        <div className="p-4 glass rounded-lg">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                                Context Summary
                            </h3>
                            <p className="text-xs text-[var(--text-secondary)]">
                                Select a context to view its overview and insights.
                            </p>
                        </div>

                        {/* File Type Filter */}
                        <div className="p-4 glass rounded-lg">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                                Filter by File Type
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setFileTypeFilter(null)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${fileTypeFilter === null
                                        ? 'bg-primary-500 text-white'
                                        : 'glass border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                >
                                    🗂️ All
                                </button>
                                <button
                                    onClick={() => setFileTypeFilter(FILE_TYPES.PDF)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${fileTypeFilter === FILE_TYPES.PDF
                                        ? 'bg-red-500 text-white'
                                        : 'glass border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                >
                                    📄 PDF
                                </button>
                                <button
                                    onClick={() => setFileTypeFilter(FILE_TYPES.CODE)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${fileTypeFilter === FILE_TYPES.CODE
                                        ? 'bg-green-500 text-white'
                                        : 'glass border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                >
                                    💻 Code
                                </button>
                                <button
                                    onClick={() => setFileTypeFilter(FILE_TYPES.IMAGE)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${fileTypeFilter === FILE_TYPES.IMAGE
                                        ? 'bg-purple-500 text-white'
                                        : 'glass border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                >
                                    🖼️ Images
                                </button>
                                <button
                                    onClick={() => setFileTypeFilter(FILE_TYPES.VIDEO)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${fileTypeFilter === FILE_TYPES.VIDEO
                                        ? 'bg-blue-500 text-white'
                                        : 'glass border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                >
                                    🎥 Videos
                                </button>
                                <button
                                    onClick={() => setFileTypeFilter(FILE_TYPES.TXT)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${fileTypeFilter === FILE_TYPES.TXT
                                        ? 'bg-yellow-500 text-white'
                                        : 'glass border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                >
                                    📃 Text
                                </button>
                            </div>
                            {fileTypeFilter && (
                                <p className="text-xs text-[var(--text-tertiary)] mt-3">
                                    Showing {filteredFiles.length} {fileTypeFilter} file(s)
                                </p>
                            )}
                        </div>
                    </div>
                );

            case CONTEXT_PANEL_TABS.RELATED:
                return (
                    <div className="space-y-4">
                        <div className="p-4 glass rounded-lg">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                                Related Files
                            </h3>
                            <p className="text-xs text-[var(--text-secondary)]">
                                No related files to display.
                            </p>
                        </div>
                    </div>
                );

            case CONTEXT_PANEL_TABS.STUDY_MODE:
                return (
                    <div className="space-y-4">
                        <div className="p-4 glass rounded-lg">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                                Practice Questions
                            </h3>
                            <p className="text-xs text-[var(--text-secondary)] mb-4">
                                Generate practice questions based on your study materials.
                            </p>

                            <div className="space-y-3">
                                {Object.values(STUDY_MODE_TYPES).map((type) => (
                                    <button
                                        key={type.id}
                                        className="w-full p-3 glass rounded-lg border border-[var(--border-color)] hover:border-primary-500 transition-all text-left group hover-glow-enhanced"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{type.icon}</span>
                                            <div>
                                                <h4 className="text-sm font-medium text-[var(--text-primary)]">
                                                    {type.label}
                                                </h4>
                                                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                                    {type.description}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <GlassPanel className="h-full flex flex-col p-4">
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4 p-1 glass rounded-lg">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
              flex-1 px-2 py-2 rounded-md
              text-xs font-medium
              transition-all duration-200
              ${activeTab === tab.id
                                ? 'bg-primary-500 text-white shadow-lg'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                            }
            `}
                    >
                        <span className="mr-1">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {renderTabContent()}
                </motion.div>
            </div>
        </GlassPanel>
    );
};

export default ContextPanel;
