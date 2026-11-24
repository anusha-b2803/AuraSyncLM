import React from 'react';
import { motion } from 'framer-motion';

const PageLoader = ({ message = "Analyzing research data..." }) => {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center fade-in bg-slate-950/20 backdrop-blur-md rounded-[40px] border border-white/5">
            <div className="relative mb-10">
                {/* Rotating Ring */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-20px] border-[1px] border-indigo-500/20 rounded-full"
                />
                <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-10px] border-[1px] border-dashed border-indigo-400/30 rounded-full"
                />
                
                <div className="relative w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-3xl font-black text-slate-950 shadow-[0_0_40px_rgba(79,70,229,0.2)]">
                    A
                    <div className="absolute inset-0 bg-indigo-500/10 rounded-3xl animate-pulse"></div>
                </div>
            </div>

            <div className="text-center">
                <h3 className="text-lg font-black text-white tracking-tight uppercase mb-2">{message}</h3>
                <div className="flex items-center justify-center gap-3">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-6">AuraSync Intelligence</p>
            </div>
        </div>
    );
};

export default PageLoader;
