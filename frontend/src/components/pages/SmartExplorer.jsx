import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../../contexts/AppStateContext';

const TOPIC_ICONS = {
    AI_and_Machine_Learning: '🤖',
    Data_Science: '📊',
    Computer_Science: '💻',
    Mathematics: '📐',
    Programming: '⌨️',
    Networking_and_Security: '🛡️',
    Database: '🗄️',
    Research_and_Academia: '🎓',
    Medicine_and_Health: '🏥',
    Law_and_Legal: '⚖️',
    Business_and_Finance: '📈',
    Engineering: '⚙️',
    Physics: '⚛️',
    Chemistry: '🧪',
    Biology: '🧬',
    Literature_and_Arts: '🎨',
    History_and_Geography: '🌍',
    General: '📂',
    Miscellaneous: '📁',
    Other: '📁',
};

const SCAN_STATUS = { IDLE: 'idle', SCANNING: 'scanning', DONE: 'done', ERROR: 'error' };
const getApiBaseUrl = () => window.API_CONFIG ? `http://127.0.0.1:${window.API_CONFIG.port}` : 'http://127.0.0.1:8000';
const getHeaders = (extra = {}) => ({
    ...(window.API_CONFIG ? { 'Authorization': `Bearer ${window.API_CONFIG.token}` } : {}),
    ...extra
});

const SmartExplorer = () => {
    const {
        state,
        setExplorerView,
        setFiles,
    } = useAppState();
    const [scanStatus, setScanStatus] = useState(SCAN_STATUS.IDLE);
    const [organizedStructure, setOrganizedStructure] = useState([]);
    const [scanError, setScanError] = useState(null);
    const [activeFolder, setActiveFolder] = useState(null); 
    
    // Drive selection logic
    const [availableDrives, setAvailableDrives] = useState([]);
    const [selectedPaths, setSelectedPaths] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);

    const fetchDrives = useCallback(async () => {
        if (window.electron?.organizer?.getDefaultScanRoots) {
            try {
                const drives = await window.electron.organizer.getDefaultScanRoots();
                if (drives && drives.length > 0) {
                    setAvailableDrives(drives);
                    setSelectedPaths(drives);
                    return;
                }
            } catch (e) {
                console.warn('IPC drive fetch failed, falling back to HTTP:', e);
            }
        }

        const attempt = async () => {
            try {
                const res = await fetch(`${getApiBaseUrl()}/drives`, { signal: AbortSignal.timeout(4000), headers: getHeaders() });
                if (!res.ok) throw new Error('not ready');
                const data = await res.json();
                if (data.drives && data.drives.length > 0) {
                    setAvailableDrives(data.drives);
                    setSelectedPaths(data.drives);
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        };

        for (let i = 0; i < 20; i++) {
            const success = await attempt();
            if (success) return;
            await new Promise(r => setTimeout(r, 4000));
        }
    }, []);

    const setFilesRef = useRef(setFiles);
    useEffect(() => { setFilesRef.current = setFiles; }, [setFiles]);

    const updateGlobalState = useCallback((structure) => {
        const allFiles = [];
        (structure || []).forEach(cat => {
            (cat.subfolders || []).forEach(topic => {
                (topic.subfolders || []).forEach(sub => {
                    allFiles.push(...(sub.files || []));
                });
            });
        });
        setFilesRef.current(allFiles);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const fetchOnce = async () => {
            try {
                const userId = state.user?.uid || 'default';
                const healthRes = await fetch(`${getApiBaseUrl()}/health?userId=${userId}`, { signal: controller.signal, headers: getHeaders() });
                const healthData = await healthRes.json();
                
                if (healthData.files_organized) {
                    const res = await fetch(`${getApiBaseUrl()}/files?userId=${userId}`, { signal: controller.signal, headers: getHeaders() });
                    const data = await res.json();
                    if (data.structure) {
                        setOrganizedStructure(data.structure);
                        updateGlobalState(data.structure);
                        setScanStatus(SCAN_STATUS.DONE);
                    }
                }
            } catch (err) {
                if (err.name !== 'AbortError') console.warn('fetchStructure:', err.message);
            }
        };
        fetchOnce();
        fetchDrives();
        return () => controller.abort();
    }, [fetchDrives, updateGlobalState, state.user?.uid]);

    const [scanProgress, setScanProgress] = useState('Starting scan...');
    const [lastScanDate, setLastScanDate] = useState(() => localStorage.getItem('aurasync_last_full_scan'));
    const [showReminder, setShowReminder] = useState(false);

    useEffect(() => {
        if (lastScanDate) {
            const last = new Date(lastScanDate).getTime();
            const now = new Date().getTime();
            if (now - last > 7 * 24 * 60 * 60 * 1000) {
                setShowReminder(true);
            }
        } else if (scanStatus === SCAN_STATUS.DONE && organizedStructure.length > 0) {
            const now = new Date().toISOString();
            localStorage.setItem('aurasync_last_full_scan', now);
            setLastScanDate(now);
        }
    }, [lastScanDate, scanStatus, organizedStructure]);

    const runScan = useCallback(async (isForce = false) => {
        setScanStatus(SCAN_STATUS.SCANNING);
        setScanProgress(isForce ? 'Deep Analyzing Content...' : 'Fast Syncing Updates...');
        setScanError(null);

        try {
            const userId = state.user?.uid || 'default';
            const startRes = await fetch(`${getApiBaseUrl()}/organize`, {
                method: 'POST',
                headers: getHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ paths: selectedPaths, force: isForce, userId: userId })
            });
            const { job_id } = await startRes.json();
            if (!job_id) throw new Error('No job ID returned');

            for (let i = 0; i < 300; i++) { // Increased to 15 mins
                await new Promise(r => setTimeout(r, 3000));
                const statusRes = await fetch(`${getApiBaseUrl()}/organize/status/${job_id}`, { headers: getHeaders() });
                const job = await statusRes.json();

                if (job.status === 'done' && job.result) {
                    setOrganizedStructure(job.result.structure);
                    updateGlobalState(job.result.structure);
                    setScanStatus(SCAN_STATUS.DONE);
                    
                    if (isForce) {
                        const now = new Date().toISOString();
                        localStorage.setItem('aurasync_last_full_scan', now);
                        setLastScanDate(now);
                        setShowReminder(false);
                    }
                    return;
                } else if (job.status === 'error') {
                    throw new Error(job.message || 'Organization failed');
                } else if (job.message) {
                    setScanProgress(job.message);
                }
            }
            throw new Error('Timed out waiting for organization to complete');
        } catch (err) {
            console.error('Scan error:', err);
            setScanError(err.message);
            setScanStatus(SCAN_STATUS.ERROR);
        }
    }, [selectedPaths, updateGlobalState]);

    const handleReset = async () => {
        if (!window.confirm("⚠️ This will permanently delete your organized library and reset all AI knowledge. Are you sure?")) return;
        
        setScanStatus(SCAN_STATUS.SCANNING);
        setScanProgress("Purging knowledge base...");
        
        try {
            const userId = state.user?.uid || 'default';
            const res = await fetch(`${getApiBaseUrl()}/system/reset?userId=${userId}`, { method: 'POST', headers: getHeaders() });
            if (!res.ok) throw new Error("Reset failed");
            
            setOrganizedStructure([]);
            updateGlobalState([]);
            setLastScanDate(null);
            localStorage.removeItem('aurasync_last_full_scan');
            setScanStatus(SCAN_STATUS.IDLE);
            alert("Library purged. You can now start a fresh Full Scan.");
        } catch (err) {
            setScanError(err.message);
            setScanStatus(SCAN_STATUS.ERROR);
        }
    };

    const toggleDriveSelection = (drive) => {
        setSelectedPaths(prev => 
            prev.includes(drive) 
                ? prev.filter(d => d !== drive) 
                : [...prev, drive]
        );
    };

    const handleOpenFile = (filePath) => {
        if (window.electron && window.electron.openFile) {
            window.electron.openFile(filePath);
        }
    };

    const handleFolderClick = (folder) => {
        setActiveFolder(folder);
        setExplorerView('files');
    };

    const handleBackToFolders = () => {
        setActiveFolder(null);
        setSelectedCategory(null);
        setExplorerView('folders');
    };

    const handleCategoryClick = (catName) => {
        setSelectedCategory(catName);
        setActiveFolder(null);
        setExplorerView('folders');
    };

    const isInFolderView = state.explorerView === 'folders';

    return (
        <div className="h-full flex rounded-[40px] overflow-hidden fade-in border border-slate-100 bg-white shadow-xl shadow-slate-100/50">
            {/* Source Sidebar */}
            <aside className="w-64 bg-violet-700 border-r border-violet-800 flex flex-col p-8">
                <p className="text-[10px] font-black text-violet-300 uppercase tracking-[0.2em] mb-6 px-2">Storage Sources</p>
                <div className="space-y-3 mb-8">
                    {availableDrives.length === 0 ? (
                        <div className="px-2 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 border-2 border-violet-300 border-t-white rounded-full animate-spin"></div>
                                <p className="text-[10px] text-violet-200 font-bold">Backend loading...</p>
                            </div>
                            <button onClick={fetchDrives} className="text-[9px] font-black text-violet-300 uppercase tracking-widest hover:text-white underline">Retry Now</button>
                        </div>
                    ) : (
                        availableDrives.map(drive => (
                            <button key={drive} onClick={() => toggleDriveSelection(drive)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all border ${selectedPaths.includes(drive) ? 'bg-white border-white text-violet-700 shadow-lg' : 'border-transparent text-violet-200 hover:bg-white/10'}`}>
                                <span className="text-lg">💽</span>
                                <div className="text-left">
                                    <p className="text-[11px] font-black uppercase tracking-widest">{drive}</p>
                                    <p className="text-[9px] text-slate-400 font-bold">Source</p>
                                </div>
                                {selectedPaths.includes(drive) && <div className="ml-auto w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.4)]"></div>}
                            </button>
                        ))
                    )}
                </div>

                <p className="text-[10px] font-black text-violet-300 uppercase tracking-[0.2em] mb-6 px-2">Knowledge Clusters</p>
                <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <button onClick={handleBackToFolders}
                        className={`w-full px-4 py-3 rounded-2xl text-left text-[10px] font-black uppercase tracking-widest transition-all ${isInFolderView && !selectedCategory ? 'bg-white text-violet-700 shadow-lg' : 'text-violet-200 hover:bg-white/10'}`}>📚 All Hubs</button>
                    {organizedStructure.map(cat => (
                        <button key={cat.name} onClick={() => handleCategoryClick(cat.name)}
                            className={`w-full px-4 py-3 rounded-2xl text-left text-[10px] font-bold transition-all truncate ${selectedCategory === cat.name ? 'bg-white text-violet-700 shadow-lg' : 'text-violet-200 hover:bg-white/10 hover:text-white'}`}>
                            {TOPIC_ICONS[cat.name] || '📂'} {cat.name.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
            </aside>

            {/* Main Library View */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {/* Header/Toolbar */}
                <div className="px-10 py-8 border-b border-slate-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            {!isInFolderView && (
                                <button onClick={handleBackToFolders} className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-violet-50 rounded-2xl border border-slate-100">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                            )}
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{isInFolderView ? 'AuraSync Library' : activeFolder?.name.replace(/_/g, ' ')}</h2>
                                <div className="flex items-center gap-4 mt-1">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{isInFolderView ? `${organizedStructure.length} Hubs` : `${activeFolder?.files.length} Files`}</p>
                                    {lastScanDate && (
                                        <>
                                            <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Last Sync: {new Date(lastScanDate).toLocaleDateString()}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={handleReset} disabled={scanStatus === SCAN_STATUS.SCANNING}
                                className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 border-2 ${scanStatus === SCAN_STATUS.SCANNING ? 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed' : 'border-rose-200 text-rose-500 hover:bg-rose-500 hover:text-white'}`}>
                                🗑️ Reset Library
                            </button>
                            <button onClick={() => runScan(false)} disabled={scanStatus === SCAN_STATUS.SCANNING}
                                className={`px-8 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg ${scanStatus === SCAN_STATUS.SCANNING ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-violet-600 text-white hover:bg-violet-700 hover:scale-105'}`}>
                                {scanStatus === SCAN_STATUS.SCANNING ? 'Syncing...' : 'Refresh'}
                            </button>
                            <button onClick={() => runScan(true)} disabled={scanStatus === SCAN_STATUS.SCANNING}
                                className={`px-8 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg border-2 ${scanStatus === SCAN_STATUS.SCANNING ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white hover:scale-105'}`}>
                                {scanStatus === SCAN_STATUS.SCANNING ? 'Analyzing...' : 'Full Scan'}
                            </button>
                        </div>
                    </div>

                    {scanStatus === SCAN_STATUS.SCANNING && (
                        <div className="mt-6 p-6 bg-violet-50/50 border border-violet-100 rounded-3xl flex items-center gap-5 animate-pulse">
                            <div className="w-6 h-6 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-violet-700 uppercase tracking-[0.2em] mb-1">Intelligence Engine Active</p>
                                <p className="text-[11px] text-violet-600 font-bold">{scanProgress}</p>
                            </div>
                            <div className="px-4 py-1.5 bg-violet-100 text-violet-700 rounded-full text-[9px] font-black uppercase tracking-widest">
                                Background Task
                            </div>
                        </div>
                    )}

                    {/* Sync Reminder Banner */}
                    <AnimatePresence>
                        {showReminder && scanStatus !== SCAN_STATUS.SCANNING && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-6 overflow-hidden">
                                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <span className="text-xl">⚠️</span>
                                        <div>
                                            <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Intelligence Update Required</p>
                                            <p className="text-[11px] text-amber-700 font-medium">Your library was last fully updated over 7 days ago.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => runScan(true)} className="px-6 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 shadow-md">Fresh Sync Now</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    {isInFolderView ? (
                        <div className="space-y-12">
                            {organizedStructure
                                .filter(cat => !selectedCategory || cat.name === selectedCategory)
                                .map((category) => (
                                <div key={category.name} className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <span className="text-xl p-2 bg-violet-50 text-violet-600 rounded-lg">{TOPIC_ICONS[category.name] || '📁'}</span>
                                        <h3 className="text-lg font-black text-slate-900 uppercase">{category.name.replace(/_/g, ' ')}</h3>
                                        <div className="h-[1px] flex-1 bg-slate-100 ml-4"></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {category.subfolders.map((topic) => (
                                            topic.subfolders.map((subtopic) => (
                                                <motion.div key={`${topic.name}-${subtopic.name}`} whileHover={{ y: -5 }} onClick={() => handleFolderClick(subtopic)}
                                                    className="p-8 bg-slate-50 hover:bg-white border border-slate-100 hover:border-violet-200 rounded-[32px] group cursor-pointer transition-all shadow-sm">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm border border-slate-50 group-hover:scale-110 transition-transform">📂</div>
                                                        <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-3 py-1 rounded-full uppercase">{subtopic.files?.length || 0} Units</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{topic.name.replace(/_/g, ' ')}</p>
                                                        <h4 className="text-sm font-black text-slate-900 group-hover:text-violet-600 uppercase truncate">{subtopic.name.replace(/_/g, ' ')}</h4>
                                                    </div>
                                                </motion.div>
                                            ))
                                        ))}
                                    </div>
                                </div>
                            ))}
                            
                            {organizedStructure.length === 0 && scanStatus !== SCAN_STATUS.SCANNING && (
                                <div className="flex flex-col items-center justify-center h-64 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-3xl mb-4">📂</div>
                                    <h4 className="text-sm font-black text-slate-900 uppercase">Library Empty</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Run a scan to organize your research</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-black text-slate-900 uppercase flex items-center gap-3">
                                    <span className="w-2 h-8 bg-violet-600 rounded-full"></span>
                                    {activeFolder?.name.replace(/_/g, ' ')}
                                </h3>
                                <button onClick={handleBackToFolders} className="text-[10px] font-black text-violet-600 uppercase tracking-widest hover:underline">
                                    ← Back to Hubs
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {activeFolder?.files.map((file, idx) => (
                                    <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} onClick={() => handleOpenFile(file.path)}
                                        className="p-5 bg-white border border-slate-100 rounded-2xl hover:border-violet-200 hover:shadow-md cursor-pointer group transition-all flex items-center gap-5">
                                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-2xl group-hover:bg-violet-50 transition-colors">
                                            {file.name.endsWith('.pdf') ? '📕' : file.name.endsWith('.docx') ? '📘' : '📄'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h5 className="text-sm font-bold text-slate-900 truncate group-hover:text-violet-600">{file.name}</h5>
                                            <p className="text-[10px] text-slate-400 font-medium truncate">{file.path}</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmartExplorer;