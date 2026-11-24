import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { updateProfile } from 'firebase/auth';
import { SCAN_STATES, WORKSPACE_VIEWS } from '../utils/constants';
import { auth } from '../utils/firebase';

const AppStateContext = createContext();

// Load persisted data from localStorage
const loadFromStorage = (key, defaultValue, uid = null) => {
    try {
        const storageKey = uid ? `${uid}_${key}` : key;
        const item = window.localStorage.getItem(storageKey);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error loading ${key} from localStorage:`, error);
        return defaultValue;
    }
};

const saveToStorage = (key, value, uid = null) => {
    try {
        const storageKey = uid ? `${uid}_${key}` : key;
        window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error);
    }
};

// Initial state
const initialState = {
    user: null, // Firebase user object
    scanState: SCAN_STATES.IDLE,
    contexts: [],
    files: [],
    selectedContext: null,
    workspaceView: WORKSPACE_VIEWS.EMPTY,
    isOnline: false,
    selectedFile: null,
    searchQuery: '',
    fileTypeFilter: null, // null means all file types
    favorites: loadFromStorage('study-workspace-favorites', []),
    showFavoritesOnly: false, // When true, show only favorited files
    tasks: loadFromStorage('study-workspace-tasks', []),
    notes: loadFromStorage('study-workspace-notes', []),
    activeChatTab: 'chat', // chat, tasks, notes
    activeSection: 'explorer', // explorer, notes, tasks, chat
    explorerView: 'folders', // folders, files
    selectedFolder: null,
    explorerFilter: 'all', // all, recents, favourites, pinned
    chatMode: 'offline', // online, offline
    activeStudyMode: null, // 2-mark, 5-mark, 10-mark
    userProfile: loadFromStorage('study-workspace-profile', {
        name: 'User',
        email: '',
        bio: '',
        avatar: null,
        studyTime: 0,
        filesViewed: 0,
    }),
    settings: loadFromStorage('study-workspace-settings', {
        theme: 'light',
        autoScan: true,
        scanInterval: 60,
        excludedFolders: [],
        defaultStudyMode: '2-mark',
        aiAssistanceLevel: 'medium',
        fontSize: 'medium',
        enableAnimations: true,
        glassmorphismIntensity: 'medium',
    }),
    showSettings: false,
    showProfile: false,
    showAuth: false,
    ollamaStatus: 'checking', // checking, installed, missing, running, stopped
};

// Action types
const ACTION_TYPES = {
    SET_USER: 'SET_USER',
    SET_SCAN_STATE: 'SET_SCAN_STATE',
    SET_CONTEXTS: 'SET_CONTEXTS',
    SET_FILES: 'SET_FILES',
    SELECT_CONTEXT: 'SELECT_CONTEXT',
    SET_WORKSPACE_VIEW: 'SET_WORKSPACE_VIEW',
    TOGGLE_ONLINE: 'TOGGLE_ONLINE',
    SELECT_FILE: 'SELECT_FILE',
    SET_SEARCH_QUERY: 'SET_SEARCH_QUERY',
    SET_FILE_TYPE_FILTER: 'SET_FILE_TYPE_FILTER',
    TOGGLE_FAVORITE: 'TOGGLE_FAVORITE',
    TOGGLE_FAVORITES_FILTER: 'TOGGLE_FAVORITES_FILTER',
    TOGGLE_PIN: 'TOGGLE_PIN',
    ADD_TASK: 'ADD_TASK',
    UPDATE_TASK: 'UPDATE_TASK',
    DELETE_TASK: 'DELETE_TASK',
    ADD_NOTE: 'ADD_NOTE',
    UPDATE_NOTE: 'UPDATE_NOTE',
    DELETE_NOTE: 'DELETE_NOTE',
    SET_ACTIVE_CHAT_TAB: 'SET_ACTIVE_CHAT_TAB',
    SET_ACTIVE_SECTION: 'SET_ACTIVE_SECTION',
    SET_EXPLORER_VIEW: 'SET_EXPLORER_VIEW',
    SELECT_FOLDER: 'SELECT_FOLDER',
    SET_EXPLORER_FILTER: 'SET_EXPLORER_FILTER',
    SET_CHAT_MODE: 'SET_CHAT_MODE',
    SET_ACTIVE_STUDY_MODE: 'SET_ACTIVE_STUDY_MODE',
    UPDATE_USER_PROFILE: 'UPDATE_USER_PROFILE',
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    TOGGLE_SETTINGS: 'TOGGLE_SETTINGS',
    TOGGLE_PROFILE: 'TOGGLE_PROFILE',
    TOGGLE_AUTH: 'TOGGLE_AUTH',
    SET_OLLAMA_STATUS: 'SET_OLLAMA_STATUS',
    LOAD_USER_DATA: 'LOAD_USER_DATA'
};

// Reducer
function appStateReducer(state, action) {
    let newState;
    switch (action.type) {
        case ACTION_TYPES.SET_USER:
            return { ...state, user: action.payload };
        case ACTION_TYPES.SET_SCAN_STATE:
            return { ...state, scanState: action.payload };
        case ACTION_TYPES.SET_CONTEXTS:
            return { ...state, contexts: action.payload };
        case ACTION_TYPES.SET_FILES:
            return { ...state, files: action.payload };
        case ACTION_TYPES.SELECT_CONTEXT:
            return { ...state, selectedContext: action.payload };
        case ACTION_TYPES.SET_WORKSPACE_VIEW:
            return { ...state, workspaceView: action.payload };
        case ACTION_TYPES.TOGGLE_ONLINE:
            return { ...state, isOnline: !state.isOnline };
        case ACTION_TYPES.SELECT_FILE:
            return { ...state, selectedFile: action.payload };
        case ACTION_TYPES.SET_SEARCH_QUERY:
            return { ...state, searchQuery: action.payload };
        case ACTION_TYPES.SET_FILE_TYPE_FILTER:
            return { ...state, fileTypeFilter: action.payload };
        case ACTION_TYPES.TOGGLE_FAVORITE:
            newState = {
                ...state,
                favorites: state.favorites.includes(action.payload)
                    ? state.favorites.filter(id => id !== action.payload)
                    : [...state.favorites, action.payload]
            };
            saveToStorage('study-workspace-favorites', newState.favorites);
            return newState;
        case ACTION_TYPES.TOGGLE_FAVORITES_FILTER:
            return { ...state, showFavoritesOnly: !state.showFavoritesOnly };
        case ACTION_TYPES.TOGGLE_PIN:
            newState = {
                ...state,
                files: state.files.map(file =>
                    file.id === action.payload
                        ? { ...file, pinned: !file.pinned }
                        : file
                )
            };
            return newState;
        case ACTION_TYPES.UPDATE_USER_PROFILE:
            newState = {
                ...state,
                userProfile: { ...state.userProfile, ...action.payload }
            };
            return newState;
        case ACTION_TYPES.ADD_TASK:
            newState = {
                ...state,
                tasks: [...state.tasks, action.payload]
            };
            return newState;
        case ACTION_TYPES.UPDATE_TASK:
            newState = {
                ...state,
                tasks: state.tasks.map(t => t.id === action.payload.id ? { ...t, ...action.payload.updates } : t)
            };
            return newState;
        case ACTION_TYPES.DELETE_TASK:
            newState = {
                ...state,
                tasks: state.tasks.filter(t => t.id !== action.payload)
            };
            return newState;
        case ACTION_TYPES.ADD_NOTE:
            newState = {
                ...state,
                notes: [...state.notes, action.payload]
            };
            return newState;
        case ACTION_TYPES.UPDATE_NOTE:
            newState = {
                ...state,
                notes: state.notes.map(n => n.id === action.payload.id ? { ...n, ...action.payload.updates } : n)
            };
            return newState;
        case ACTION_TYPES.DELETE_NOTE:
            newState = {
                ...state,
                notes: state.notes.filter(n => n.id !== action.payload)
            };
            return newState;
        case ACTION_TYPES.SET_ACTIVE_CHAT_TAB:
            return { ...state, activeChatTab: action.payload };
        case ACTION_TYPES.SET_ACTIVE_SECTION:
            return { ...state, activeSection: action.payload };
        case ACTION_TYPES.SET_EXPLORER_VIEW:
            return { ...state, explorerView: action.payload };
        case ACTION_TYPES.SELECT_FOLDER:
            return { ...state, selectedFolder: action.payload };
        case ACTION_TYPES.SET_EXPLORER_FILTER:
            return { ...state, explorerFilter: action.payload };
        case ACTION_TYPES.SET_CHAT_MODE:
            return { ...state, chatMode: action.payload };
        case ACTION_TYPES.SET_ACTIVE_STUDY_MODE:
            return { ...state, activeStudyMode: action.payload };
        case ACTION_TYPES.UPDATE_SETTINGS:
            newState = {
                ...state,
                settings: { ...state.settings, ...action.payload }
            };
            return newState;
        case ACTION_TYPES.TOGGLE_SETTINGS:
            return { ...state, showSettings: !state.showSettings };
        case ACTION_TYPES.TOGGLE_PROFILE:
            return { ...state, showProfile: !state.showProfile };
        case ACTION_TYPES.TOGGLE_AUTH:
            return { ...state, showAuth: !state.showAuth };
        case 'LOAD_USER_DATA':
            return {
                ...state,
                favorites: action.payload.favorites,
                tasks: action.payload.tasks,
                notes: action.payload.notes,
                settings: action.payload.settings,
                userProfile: action.payload.userProfile
            };
        case ACTION_TYPES.SET_OLLAMA_STATUS:
            return { ...state, ollamaStatus: action.payload };
        default:
            return state;
    }
}

export const useAppState = () => {
    const context = useContext(AppStateContext);
    if (!context) {
        throw new Error('useAppState must be used within AppStateProvider');
    }
    return context;
};

export const AppStateProvider = ({ children }) => {
    const [state, dispatch] = useReducer(appStateReducer, initialState);

    // Persist data whenever user-scoped state changes
    useEffect(() => {
        if (state.user?.uid) {
            saveToStorage('study-workspace-favorites', state.favorites, state.user.uid);
            saveToStorage('study-workspace-tasks', state.tasks, state.user.uid);
            saveToStorage('study-workspace-notes', state.notes, state.user.uid);
            saveToStorage('study-workspace-profile', state.userProfile, state.user.uid);
            saveToStorage('study-workspace-settings', state.settings, state.user.uid);
        }
    }, [state.favorites, state.tasks, state.notes, state.userProfile, state.settings, state.user?.uid]);

    // Handle Firebase Auth State
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                // Load user-specific data
                const userFavorites = loadFromStorage('study-workspace-favorites', [], user.uid);
                const userTasks = loadFromStorage('study-workspace-tasks', [], user.uid);
                const userNotes = loadFromStorage('study-workspace-notes', [], user.uid);
                const userSettings = loadFromStorage('study-workspace-settings', initialState.settings, user.uid);
                const userProfile = loadFromStorage('study-workspace-profile', {
                    name: user.displayName || 'User',
                    email: user.email,
                    bio: '',
                    avatar: user.photoURL,
                    studyTime: 0,
                    filesViewed: 0
                }, user.uid);

                dispatch({ type: ACTION_TYPES.SET_USER, payload: user });
                dispatch({ type: 'LOAD_USER_DATA', payload: {
                    favorites: userFavorites,
                    tasks: userTasks,
                    notes: userNotes,
                    settings: userSettings,
                    userProfile: userProfile
                }});
            } else {
                dispatch({ type: ACTION_TYPES.SET_USER, payload: null });
                // Reset to empty state on logout
                dispatch({ type: 'LOAD_USER_DATA', payload: {
                    favorites: [],
                    tasks: [],
                    notes: [],
                    settings: initialState.settings,
                    userProfile: { name: 'User', email: '', bio: '', avatar: null, studyTime: 0, filesViewed: 0 }
                }});
            }
        });

        return () => unsubscribe();
    }, []);

    // Actions
    const actions = {
        setUser: (user) => dispatch({ type: ACTION_TYPES.SET_USER, payload: user }),
        setScanState: (scanState) => dispatch({ type: ACTION_TYPES.SET_SCAN_STATE, payload: scanState }),
        setContexts: (contexts) => dispatch({ type: ACTION_TYPES.SET_CONTEXTS, payload: contexts }),
        setFiles: (files) => dispatch({ type: ACTION_TYPES.SET_FILES, payload: files }),
        selectContext: (contextId) => dispatch({ type: ACTION_TYPES.SELECT_CONTEXT, payload: contextId }),
        setWorkspaceView: (view) => dispatch({ type: ACTION_TYPES.SET_WORKSPACE_VIEW, payload: view }),
        toggleOnline: () => dispatch({ type: ACTION_TYPES.TOGGLE_ONLINE }),
        selectFile: (file) => dispatch({ type: ACTION_TYPES.SELECT_FILE, payload: file }),
        setSearchQuery: (query) => dispatch({ type: ACTION_TYPES.SET_SEARCH_QUERY, payload: query }),
        setFileTypeFilter: (fileType) => dispatch({ type: ACTION_TYPES.SET_FILE_TYPE_FILTER, payload: fileType }),
        toggleFavorite: (fileId) => dispatch({ type: ACTION_TYPES.TOGGLE_FAVORITE, payload: fileId }),
        toggleFavoritesFilter: () => dispatch({ type: ACTION_TYPES.TOGGLE_FAVORITES_FILTER }),
        togglePin: (fileId) => dispatch({ type: ACTION_TYPES.TOGGLE_PIN, payload: fileId }),
        addTask: (task) => dispatch({ type: ACTION_TYPES.ADD_TASK, payload: task }),
        updateTask: (id, updates) => dispatch({ type: ACTION_TYPES.UPDATE_TASK, payload: { id, updates } }),
        deleteTask: (id) => dispatch({ type: ACTION_TYPES.DELETE_TASK, payload: id }),
        addNote: (note) => dispatch({ type: ACTION_TYPES.ADD_NOTE, payload: note }),
        updateNote: (id, updates) => dispatch({ type: ACTION_TYPES.UPDATE_NOTE, payload: { id, updates } }),
        deleteNote: (id) => dispatch({ type: ACTION_TYPES.DELETE_NOTE, payload: id }),
        setActiveChatTab: (tab) => dispatch({ type: ACTION_TYPES.SET_ACTIVE_CHAT_TAB, payload: tab }),
        setActiveSection: (section) => dispatch({ type: ACTION_TYPES.SET_ACTIVE_SECTION, payload: section }),
        setExplorerView: (view) => dispatch({ type: ACTION_TYPES.SET_EXPLORER_VIEW, payload: view }),
        selectFolder: (folder) => dispatch({ type: ACTION_TYPES.SELECT_FOLDER, payload: folder }),
        setExplorerFilter: (filter) => dispatch({ type: ACTION_TYPES.SET_EXPLORER_FILTER, payload: filter }),
        setChatMode: (mode) => dispatch({ type: ACTION_TYPES.SET_CHAT_MODE, payload: mode }),
        setActiveStudyMode: (mode) => dispatch({ type: ACTION_TYPES.SET_ACTIVE_STUDY_MODE, payload: mode }),
        updateUserProfile: async (profile) => {
            dispatch({ type: ACTION_TYPES.UPDATE_USER_PROFILE, payload: profile });
            
            // Sync with Firebase if possible
            if (auth.currentUser) {
                try {
                    await updateProfile(auth.currentUser, {
                        displayName: profile.name,
                        photoURL: profile.avatar
                    });
                    // Also update the main user object in state to trigger re-renders
                    dispatch({ 
                        type: ACTION_TYPES.SET_USER, 
                        payload: { 
                            ...state.user, 
                            displayName: profile.name,
                            photoURL: profile.avatar
                        } 
                    });
                } catch (err) {
                    console.error("Failed to sync profile to Firebase:", err);
                }
            }
        },
        updateSettings: (settings) => dispatch({ type: ACTION_TYPES.UPDATE_SETTINGS, payload: settings }),
        toggleSettings: () => dispatch({ type: ACTION_TYPES.TOGGLE_SETTINGS }),
        toggleProfile: () => dispatch({ type: ACTION_TYPES.TOGGLE_PROFILE }),
        toggleAuth: () => dispatch({ type: ACTION_TYPES.TOGGLE_AUTH }),
        setOllamaStatus: (status) => dispatch({ type: ACTION_TYPES.SET_OLLAMA_STATUS, payload: status }),
    };

    const value = {
        state,
        ...actions,
    };

    return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};
