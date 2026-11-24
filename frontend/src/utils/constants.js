// App-wide constants

export const SCAN_STATES = {
    IDLE: 'idle',
    SCANNING: 'scanning',
    COMPLETED: 'completed',
};

export const WORKSPACE_VIEWS = {
    EMPTY: 'empty',
    GRID: 'grid',
    LIST: 'list',
    PREVIEW: 'preview',
    SPLIT: 'split',
    CONTEXT_BOARD: 'context-board',
};

export const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
};

export const SIDEBAR_SECTIONS = {
    SMART_EXPLORER: 'smart-explorer',
    CONTEXTS: 'contexts',
    PINNED: 'pinned',
    RECENT: 'recent',
    SETTINGS: 'settings',
};

export const CONTEXT_PANEL_TABS = {
    OVERVIEW: 'overview',
    RELATED: 'related',
    STUDY_MODE: 'study',
};


export const STUDY_MODE_TYPES = {
    TWO_MARK: {
        id: '2-mark',
        label: '2-Mark Answers',
        description: 'Quick short answer questions',
        icon: '📝',
    },
    FIVE_MARK: {
        id: '5-mark',
        label: '5-Mark Answers',
        description: 'Detailed medium-length responses',
        icon: '📚',
    },
    TEN_MARK: {
        id: '10-mark',
        label: '10-Mark Answers',
        description: 'Comprehensive long-form answers',
        icon: '📖',
    },
};

export const FILE_TYPES = {
    PDF: 'pdf',
    DOCX: 'docx',
    TXT: 'txt',
    IMAGE: 'image',
    VIDEO: 'video',
    CODE: 'code',
    OTHER: 'other',
};

export const MENTION_TYPES = {
    FILE: 'file',
    CONTEXT: 'context',
    CHATBOT: 'chatbot',
};
