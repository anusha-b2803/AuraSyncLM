import { useAppState } from '../contexts/AppStateContext';
import { useMemo } from 'react';

export const useContexts = () => {
    const { state, selectContext, setFileTypeFilter } = useAppState();

    const selectedContextData = useMemo(() => {
        if (!state.selectedContext) return null;
        return state.contexts.find(ctx => ctx.id === state.selectedContext);
    }, [state.contexts, state.selectedContext]);

    // Helper function to extract file type from file extension or type field
    const getFileType = (file) => {
        // If file has a type field, use it
        if (file.type) return file.type;

        // Otherwise, extract from filename
        const extension = file.name.split('.').pop().toLowerCase();
        const typeMap = {
            'pdf': 'pdf',
            'doc': 'docx',
            'docx': 'docx',
            'txt': 'txt',
            'md': 'txt',
            'jpg': 'image',
            'jpeg': 'image',
            'png': 'image',
            'gif': 'image',
            'mp4': 'video',
            'avi': 'video',
            'mov': 'video',
            'js': 'code',
            'jsx': 'code',
            'ts': 'code',
            'tsx': 'code',
            'py': 'code',
            'java': 'code',
            'cpp': 'code',
            'c': 'code',
            'html': 'code',
            'css': 'code',
        };
        return typeMap[extension] || 'other';
    };

    const filteredFiles = useMemo(() => {
        let files = state.files;

        // Filter by favorites first
        if (state.showFavoritesOnly) {
            files = files.filter(file => state.favorites.includes(file.id));
        }

        // Filter by context
        if (state.selectedContext) {
            files = files.filter(file =>
                file.contexts.includes(state.selectedContext)
            );
        }

        // Filter by file type
        if (state.fileTypeFilter) {
            files = files.filter(file => getFileType(file) === state.fileTypeFilter);
        }

        return files;
    }, [state.files, state.selectedContext, state.fileTypeFilter, state.showFavoritesOnly, state.favorites]);

    return {
        contexts: state.contexts,
        selectedContext: state.selectedContext,
        selectedContextData,
        filteredFiles,
        selectContext,
        fileTypeFilter: state.fileTypeFilter,
        setFileTypeFilter,
    };
};
