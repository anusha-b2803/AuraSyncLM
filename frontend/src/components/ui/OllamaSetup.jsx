import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../../contexts/AppStateContext';

const OllamaSetup = () => {
    const { state, setOllamaStatus } = useAppState();
    const [downloading, setDownloading] = useState(false);
    const [progressStatus, setProgressStatus] = useState('');
    const [downloadPercent, setDownloadPercent] = useState(0);
    const [error, setError] = useState(null);
    const [hardware, setHardware] = useState(null);
    const [selectedModel, setSelectedModel] = useState('llama3.2:latest');

    const API_BASE_URL = window.API_CONFIG ? `http://127.0.0.1:${window.API_CONFIG.port}` : 'http://127.0.0.1:8000';
    const getHeaders = (extra = {}) => ({
        ...(window.API_CONFIG ? { 'Authorization': `Bearer ${window.API_CONFIG.token}` } : {}),
        ...extra
    });

    // Probe hardware on mount to adaptively select optimal model
    useEffect(() => {
        let mounted = true;
        const fetchHardware = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/system/hardware`, {
                    headers: getHeaders()
                });
                if (res.ok) {
                    const data = await res.json();
                    if (mounted) {
                        setHardware(data);
                        if (data.recommended_model) {
                            setSelectedModel(data.recommended_model);
                        }
                    }
                }
            } catch (err) {
                console.warn('Hardware probe fallback:', err);
            }
        };
        fetchHardware();
        return () => { mounted = false; };
    }, []);

    const handleDownload = async () => {
        setDownloading(true);
        setError(null);
        setProgressStatus('Connecting to AI model repository...');
        setDownloadPercent(5);

        try {
            const res = await fetch(`${API_BASE_URL}/system/ollama/pull-stream`, {
                method: 'POST',
                headers: getHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ model: selectedModel })
            });

            if (!res.ok) throw new Error('Failed to initiate model pull');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        if (event.error) {
                            throw new Error(event.error);
                        }
                        if (event.status) {
                            setProgressStatus(event.status);
                        }
                        if (event.total && event.completed) {
                            const pct = Math.round((event.completed / event.total) * 100);
                            setDownloadPercent(Math.min(pct, 100));
                        }
                    } catch (e) {
                        // Ignore partial JSON chunks
                    }
                }
            }

            setProgressStatus('Model initialized! Starting AuraSync LM...');
            setDownloadPercent(100);
            setTimeout(() => {
                setOllamaStatus('running');
            }, 1500);

        } catch (err) {
            setError(err.message || 'Download failed. Check internet or run "ollama pull llama3.2"');
        } finally {
            setDownloading(false);
        }
    };

    const handleDismiss = () => {
        try {
            localStorage.setItem('aurasync_setup_dismissed', 'true');
        } catch (e) {}
        setOllamaStatus('running');
    };

    // If the user already completed or dismissed setup once, do not ask again
    const isDismissed = typeof window !== 'undefined' && localStorage.getItem('aurasync_setup_dismissed') === 'true';
    if (isDismissed || (state.ollamaStatus !== 'missing_model' && state.ollamaStatus !== 'offline')) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div 
                initial={{ opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100"
            >
                {/* Header */}
                <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />
                    
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-white/20">
                        <span className="text-2xl">🎓</span>
                    </div>

                    <h2 className="text-2xl font-black tracking-tight mb-1">
                        AuraSync LM Setup Wizard
                    </h2>
                    <p className="text-violet-100 text-xs font-medium">
                        Zero-configuration local AI engine setup for offline academic study
                    </p>
                </div>

                <div className="p-8">
                    {/* Hardware Profile Card */}
                    {hardware && (
                        <div className="mb-6 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    System Hardware Profile
                                </span>
                                <span className="text-[9px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                                    {hardware.tier}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                                <div><strong className="text-slate-900">RAM:</strong> {hardware.ram_gb} GB</div>
                                <div><strong className="text-slate-900">GPU:</strong> {hardware.gpu_name}</div>
                            </div>
                            <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                                <span className="text-slate-600">Adaptive Model:</span>
                                <span className="font-bold text-violet-700">{hardware.model_label}</span>
                            </div>
                        </div>
                    )}

                    {/* Progress Bar & Status */}
                    {downloading && (
                        <div className="mb-6 space-y-2">
                            <div className="flex justify-between text-xs font-bold text-slate-700">
                                <span className="truncate max-w-[280px]">{progressStatus || 'Downloading model...'}</span>
                                <span className="text-violet-600">{downloadPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <motion.div 
                                    className="bg-gradient-to-r from-violet-600 to-indigo-600 h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${downloadPercent}%` }}
                                    transition={{ ease: "easeOut" }}
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3.5 rounded-2xl text-xs font-semibold mb-6 flex items-start gap-2">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-3">
                        <button 
                            onClick={handleDownload}
                            disabled={downloading}
                            className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md hover:shadow-violet-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {downloading ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Setting up ({downloadPercent}%)...</span>
                                </>
                            ) : (
                                <span>1-Click Initialize AI Station</span>
                            )}
                        </button>

                        <button 
                            onClick={handleDismiss}
                            disabled={downloading}
                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-2xl transition-all disabled:opacity-50"
                        >
                            Continue to Workspace (Don't ask again)
                        </button>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400">
                            <strong>Offline Student Option:</strong> If you have no internet, copy the model file from a classmate via USB and run <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">ollama run {selectedModel}</code> once.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default OllamaSetup;
