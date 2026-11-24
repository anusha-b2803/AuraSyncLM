import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LoadingScreen = ({ isLoading }) => {
    const [progress, setProgress] = useState(0);
    const [loadingText, setLoadingText] = useState('Initializing...');

    useEffect(() => {
        if (!isLoading) return;

        const progressInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 95) return prev;
                return prev + Math.random() * 15;
            });
        }, 200);

        const textStages = [
            { time: 0, text: 'Initializing workspace...' },
            { time: 1000, text: 'Scanning directories...' },
            { time: 2000, text: 'Analyzing content...' },
            { time: 3000, text: 'Almost ready...' },
        ];

        textStages.forEach(stage => {
            setTimeout(() => setLoadingText(stage.text), stage.time);
        });

        return () => {
            clearInterval(progressInterval);
            setProgress(0);
            setLoadingText('Initializing...');
        };
    }, [isLoading]);

    // Particle system
    const particles = Array.from({ length: 20 }, (_, i) => i);

    return (
        <AnimatePresence>
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.5, exit: { duration: 0.8 } }}
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
                    style={{
                        background: '#000000',
                    }}
                >
                    {/* Animated Grid Background */}
                    <div className="absolute inset-0 opacity-10">
                        <motion.div
                            animate={{
                                backgroundPosition: ['0% 0%', '100% 100%'],
                            }}
                            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                            className="w-full h-full"
                            style={{
                                backgroundImage: `
                                    linear-gradient(rgba(99, 102, 241, 0.3) 1px, transparent 1px),
                                    linear-gradient(90deg, rgba(99, 102, 241, 0.3) 1px, transparent 1px)
                                `,
                                backgroundSize: '50px 50px',
                            }}
                        />
                    </div>

                    {/* Floating Particles */}
                    {particles.map((i) => (
                        <motion.div
                            key={i}
                            className="absolute w-1 h-1 rounded-full bg-indigo-400"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                            }}
                            animate={{
                                y: [0, -30, 0],
                                opacity: [0, 1, 0],
                            }}
                            transition={{
                                duration: Math.random() * 3 + 2,
                                repeat: Infinity,
                                delay: Math.random() * 2,
                            }}
                        />
                    ))}

                    {/* Flying Rocket - Top Right */}
                    <motion.div
                        className="absolute top-20"
                        style={{ right: 0 }}
                        initial={{ x: -200, y: 100 }}
                        animate={{
                            x: [0, window.innerWidth + 200],
                            y: [100, 50, 150, 80],
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: 'linear',
                        }}
                    >
                        <motion.div
                            animate={{
                                rotate: [0, 3, -3, 0],
                            }}
                            transition={{
                                duration: 0.8,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                        >
                            {/* Paper Rocket SVG */}
                            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
                                {/* Rocket Body */}
                                <motion.path
                                    d="M50 10 L70 50 L60 50 L60 80 L40 80 L40 50 L30 50 Z"
                                    fill="url(#rocketGradient)"
                                    animate={{
                                        scale: [1, 1.05, 1],
                                    }}
                                    transition={{
                                        duration: 0.5,
                                        repeat: Infinity,
                                    }}
                                />
                                {/* Window */}
                                <circle cx="50" cy="40" r="8" fill="rgba(59, 130, 246, 0.3)" />
                                <circle cx="50" cy="40" r="5" fill="rgba(99, 102, 241, 0.5)" />

                                {/* Flames */}
                                <motion.path
                                    d="M40 80 L35 95 L45 85 Z"
                                    fill="url(#flameGradient1)"
                                    animate={{
                                        scaleY: [1, 1.3, 1],
                                        opacity: [0.7, 1, 0.7],
                                    }}
                                    transition={{
                                        duration: 0.3,
                                        repeat: Infinity,
                                    }}
                                />
                                <motion.path
                                    d="M50 80 L48 98 L52 98 Z"
                                    fill="url(#flameGradient2)"
                                    animate={{
                                        scaleY: [1, 1.4, 1],
                                        opacity: [0.8, 1, 0.8],
                                    }}
                                    transition={{
                                        duration: 0.25,
                                        repeat: Infinity,
                                        delay: 0.1,
                                    }}
                                />
                                <motion.path
                                    d="M60 80 L65 95 L55 85 Z"
                                    fill="url(#flameGradient1)"
                                    animate={{
                                        scaleY: [1, 1.3, 1],
                                        opacity: [0.7, 1, 0.7],
                                    }}
                                    transition={{
                                        duration: 0.3,
                                        repeat: Infinity,
                                        delay: 0.15,
                                    }}
                                />

                                <defs>
                                    <linearGradient id="rocketGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#6366f1" />
                                        <stop offset="100%" stopColor="#8b5cf6" />
                                    </linearGradient>
                                    <linearGradient id="flameGradient1" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#fbbf24" />
                                        <stop offset="100%" stopColor="#f59e0b" />
                                    </linearGradient>
                                    <linearGradient id="flameGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#fbbf24" />
                                        <stop offset="50%" stopColor="#f59e0b" />
                                        <stop offset="100%" stopColor="#ef4444" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </motion.div>
                    </motion.div>

                    {/* Main Content Container */}
                    <div className="relative z-10 text-center px-8">
                        {/* Spinning Circle Loader */}
                        <div className="mb-8 flex justify-center">
                            <div className="relative w-24 h-24">
                                {/* Outer spinning ring */}
                                <motion.div
                                    className="absolute inset-0 rounded-full"
                                    style={{
                                        background: 'conic-gradient(from 0deg, transparent 0%, #6366f1 25%, #8b5cf6 50%, #3b82f6 75%, transparent 100%)',
                                    }}
                                    animate={{ rotate: 360 }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: 'linear',
                                    }}
                                />

                                {/* Inner circle - creates ring effect */}
                                <div className="absolute inset-2 rounded-full bg-[#0a0a0f]" />

                                {/* Center icon */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <motion.div
                                        className="text-3xl font-bold bg-gradient-to-br from-indigo-400 to-purple-400 bg-clip-text text-transparent"
                                        animate={{
                                            scale: [1, 1.1, 1],
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                        }}
                                    >
                                        S
                                    </motion.div>
                                </div>

                                {/* Orbiting dots */}
                                {[0, 120, 240].map((angle, i) => (
                                    <motion.div
                                        key={i}
                                        className="absolute w-3 h-3 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400"
                                        style={{
                                            top: '50%',
                                            left: '50%',
                                        }}
                                        animate={{
                                            x: [
                                                Math.cos((angle * Math.PI) / 180) * 45,
                                                Math.cos(((angle + 360) * Math.PI) / 180) * 45,
                                            ],
                                            y: [
                                                Math.sin((angle * Math.PI) / 180) * 45,
                                                Math.sin(((angle + 360) * Math.PI) / 180) * 45,
                                            ],
                                            scale: [1, 1.3, 1],
                                        }}
                                        transition={{
                                            duration: 3,
                                            repeat: Infinity,
                                            ease: 'linear',
                                        }}
                                    />
                                ))}

                                {/* Glow effect */}
                                <motion.div
                                    className="absolute inset-0 rounded-full blur-2xl"
                                    animate={{
                                        opacity: [0.3, 0.6, 0.3],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                    }}
                                    style={{
                                        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4), transparent)',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Title with Shimmer Effect */}
                        <motion.h1
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-5xl md:text-6xl font-bold mb-2"
                        >
                            <motion.span
                                style={{
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 25%, #3b82f6 50%, #8b5cf6 75%, #6366f1 100%)',
                                    backgroundSize: '200% auto',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }}
                                animate={{
                                    backgroundPosition: ['0% center', '200% center'],
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: 'linear',
                                }}
                            >
                                AuraSync LM
                            </motion.span>
                        </motion.h1>

                        {/* Subtitle */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                            className="text-sm md:text-base text-blue-300/80 mb-8 tracking-wider"
                        >
                            Adaptive Learning Platform
                        </motion.p>

                        {/* Progress Bar Container */}
                        <div className="w-80 max-w-full mx-auto mb-6">
                            <div className="relative">
                                <motion.div
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute inset-0 rounded-full blur-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 opacity-50"
                                />

                                <div className="relative h-2 bg-white/5 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                                    <motion.div
                                        className="h-full rounded-full relative overflow-hidden"
                                        style={{
                                            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6, #6366f1)',
                                            backgroundSize: '200% 100%',
                                            width: `${progress}%`,
                                        }}
                                        animate={{
                                            backgroundPosition: ['0% 0%', '200% 0%'],
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: 'linear',
                                        }}
                                    >
                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                            animate={{
                                                x: ['-100%', '200%'],
                                            }}
                                            transition={{
                                                duration: 1.5,
                                                repeat: Infinity,
                                                ease: 'easeInOut',
                                            }}
                                        />
                                    </motion.div>
                                </div>
                            </div>

                            <motion.div
                                className="text-center mt-3 text-sm font-medium text-blue-300/80"
                                key={Math.floor(progress)}
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                {Math.floor(progress)}%
                            </motion.div>
                        </div>

                        {/* Loading Text */}
                        <motion.div
                            key={loadingText}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-blue-200/70 mb-8 font-medium"
                        >
                            {loadingText}
                            <motion.span
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            >

                            </motion.span>
                        </motion.div>

                        {/* Pulsing Dots */}
                        <div className="flex justify-center gap-2">
                            {[0, 1, 2, 3].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    }}
                                    animate={{
                                        scale: [0.8, 1.3, 0.8],
                                        opacity: [0.4, 1, 0.4],
                                    }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        delay: i * 0.15,
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Decorative Corners */}
                    {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((position) => (
                        <motion.div
                            key={position}
                            className="absolute w-20 h-20"
                            style={{
                                [position.split('-')[0]]: '2rem',
                                [position.split('-')[1]]: '2rem',
                            }}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 0.3, scale: 1 }}
                            transition={{ delay: 0.5, duration: 0.8 }}
                        >
                            <div
                                className="w-full h-full"
                                style={{
                                    borderTop: position.includes('top') ? '2px solid rgba(99, 102, 241, 0.3)' : 'none',
                                    borderBottom: position.includes('bottom') ? '2px solid rgba(99, 102, 241, 0.3)' : 'none',
                                    borderLeft: position.includes('left') ? '2px solid rgba(99, 102, 241, 0.3)' : 'none',
                                    borderRight: position.includes('right') ? '2px solid rgba(99, 102, 241, 0.3)' : 'none',
                                }}
                            />
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LoadingScreen;
