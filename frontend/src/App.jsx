import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppStateProvider } from './contexts/AppStateContext';
import GlobalLayout from './components/layout/GlobalLayout';
import './styles/globals.css';
import './styles/animations.css';

const SplashLoader = () => {
    const [stage, setStage] = React.useState(0);
    const stages = ["Initializing Neural Core", "Calibrating Llama 3.1", "Indexing Research Units", "Readying Workspace"];

    React.useEffect(() => {
        const interval = setInterval(() => {
            setStage(prev => (prev + 1) % stages.length);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950 overflow-hidden font-inter">
            {/* Animated Mesh Gradient */}
            <div className="absolute inset-0 overflow-hidden">
                <motion.div 
                    animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                        x: [-50, 50, -50],
                        y: [-50, 50, -50]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-20%] left-[-20%] w-[100%] h-[100%] bg-indigo-600/10 rounded-full blur-[140px]"
                />
                <motion.div 
                    animate={{ 
                        scale: [1.2, 1, 1.2],
                        rotate: [0, -90, 0],
                        x: [50, -50, 50],
                        y: [50, -50, 50]
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-20%] right-[-20%] w-[100%] h-[100%] bg-blue-600/10 rounded-full blur-[140px]"
                />
            </div>

            {/* Central Content */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 flex flex-col items-center"
            >
                <div className="relative mb-12">
                    {/* Ring Pulse */}
                    {[1, 2, 3].map((i) => (
                        <motion.div
                            key={i}
                            animate={{ scale: [1, 2], opacity: [0.3, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                            className="absolute inset-0 bg-indigo-500/20 rounded-[40px] blur-xl"
                        />
                    ))}
                    
                    <div className="w-28 h-28 bg-white rounded-[40px] flex items-center justify-center text-slate-950 text-5xl font-black shadow-[0_0_60px_rgba(79,70,229,0.3)] relative z-20">
                        A
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-lg">LM</div>
                    </div>
                </div>

                <div className="text-center">
                    <h1 className="text-4xl font-black text-white tracking-tighter mb-4 flex items-center gap-3">
                        AuraSync <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-indigo-400 text-2xl">INTELLIGENCE</span>
                    </h1>
                    
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-64 h-[2px] bg-white/5 rounded-full overflow-hidden relative">
                            <motion.div
                                initial={{ x: "-100%" }}
                                animate={{ x: "0%" }}
                                transition={{ duration: 2.5, ease: "easeInOut" }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent w-full"
                            />
                        </div>
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={stage}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]"
                            >
                                {stages[stage]}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>

            {/* Bottom Credits */}
            <div className="absolute bottom-12 flex items-center gap-4 opacity-20">
                <span className="text-[9px] font-bold text-white uppercase tracking-widest">Neural Framework V1.0</span>
                <div className="w-1 h-1 bg-white rounded-full"></div>
                <span className="text-[9px] font-bold text-white uppercase tracking-widest">Local Privacy Encrypted</span>
            </div>
        </div>
    );
};

function App() {
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 2000);
        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return <SplashLoader />;
    }

    return (
        <ThemeProvider>
            <AppStateProvider>
                <GlobalLayout />
            </AppStateProvider>
        </ThemeProvider>
    );
}

export default App;
