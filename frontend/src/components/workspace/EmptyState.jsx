import React from 'react';
import { motion } from 'framer-motion';

const EmptyState = () => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center h-full text-center p-8"
        >
            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatType: 'reverse',
                }}
                className="text-8xl mb-6"
            >
                📂
            </motion.div>

            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                Waiting for File Scan
            </h2>

            <p className="text-[var(--text-secondary)] max-w-md mb-6">
                Your workspace will organize itself after scanning your files.
                Contexts will appear automatically based on what you study.
            </p>

            <div className="flex items-center gap-2 text-primary-500">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full"
                />
                <span className="text-sm font-medium">Initializing...</span>
            </div>
        </motion.div>
    );
};

export default EmptyState;
