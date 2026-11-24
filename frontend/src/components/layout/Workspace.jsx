import React from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { useContexts } from '../../hooks/useContexts';
import { WORKSPACE_VIEWS } from '../../utils/constants';
import EmptyState from '../workspace/EmptyState';
import FileGrid from '../workspace/FileGrid';
import FileList from '../workspace/FileList';

const Workspace = () => {
    const { state, selectFile, setWorkspaceView } = useAppState();
    const { filteredFiles, selectContext } = useContexts();

    const renderView = () => {
        switch (state.workspaceView) {
            case WORKSPACE_VIEWS.EMPTY:
                return <EmptyState />;

            case WORKSPACE_VIEWS.GRID:
                return (
                    <FileGrid
                        files={filteredFiles}
                        contexts={state.contexts}
                        onFileClick={(file) => {
                            selectFile(file);
                            console.log('File clicked:', file);
                        }}
                        onContextClick={(contextId) => {
                            selectContext(contextId);
                        }}
                    />
                );

            case WORKSPACE_VIEWS.LIST:
                return (
                    <FileList
                        files={filteredFiles}
                        contexts={state.contexts}
                        onFileClick={(file) => {
                            selectFile(file);
                            console.log('File clicked:', file);
                        }}
                        onContextClick={(contextId) => {
                            selectContext(contextId);
                        }}
                    />
                );

            case WORKSPACE_VIEWS.PREVIEW:
                // TODO: Implement preview view
                return (
                    <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">
                        Preview view - Coming soon
                    </div>
                );

            default:
                return <EmptyState />;
        }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--bg-secondary)] rounded-lg overflow-hidden">
            {/* View Controls */}
            {state.workspaceView !== WORKSPACE_VIEWS.EMPTY && (
                <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                            {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
                        </span>
                        {state.selectedContext && (
                            <span className="text-xs text-[var(--text-tertiary)]">
                                in selected context
                            </span>
                        )}
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center gap-1 p-1 glass rounded-lg">
                        <button
                            onClick={() => setWorkspaceView(WORKSPACE_VIEWS.GRID)}
                            className={`px-3 py-1 rounded text-xs transition-colors ${state.workspaceView === WORKSPACE_VIEWS.GRID
                                ? 'bg-primary-500 text-white'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            title="Grid View"
                        >
                            ⊞
                        </button>
                        <button
                            onClick={() => setWorkspaceView(WORKSPACE_VIEWS.LIST)}
                            className={`px-3 py-1 rounded text-xs transition-colors ${state.workspaceView === WORKSPACE_VIEWS.LIST
                                ? 'bg-primary-500 text-white'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            title="List View"
                        >
                            ☰
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {renderView()}
            </div>
        </div>
    );
};

export default Workspace;
