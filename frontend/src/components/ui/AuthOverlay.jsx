import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../../utils/firebase';
import { ref, set } from 'firebase/database';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile 
} from 'firebase/auth';
import { useAppState } from '../../contexts/AppStateContext';

export default function AuthOverlay({ isMandatory = false }) {
    const { toggleAuth, updateUserProfile, setUser } = useAppState();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isLogin) {
                // Firebase Login
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Keep profile updated in DB
                set(ref(db, `users/${user.uid}`), {
                    fullName: user.displayName || 'User',
                    email: user.email,
                    lastLogin: new Date().toISOString()
                });

                updateUserProfile({ name: user.displayName || 'User', email: user.email });
                setUser({
                    id: user.uid,
                    email: user.email,
                    displayName: user.displayName
                });
                toggleAuth(); // Close overlay on success
            } else {
                // Firebase Registration
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Update Profile with Full Name
                await updateProfile(user, {
                    displayName: fullName
                });

                // Save user metadata to DB
                await set(ref(db, `users/${user.uid}`), {
                    fullName: fullName,
                    email: user.email,
                    createdAt: new Date().toISOString()
                });

                setMessage('Account created successfully! You can now sign in.');
                setIsLogin(true);
            }
        } catch (err) {
            console.error("Auth Error:", err);
            let errorMessage = "Authentication failed.";
            
            // Handle specific Firebase errors
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                errorMessage = "Invalid email or password.";
            } else if (err.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered.";
            } else if (err.code === 'auth/weak-password') {
                errorMessage = "Password should be at least 6 characters.";
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = "Invalid email address.";
            } else if (err.code === 'auth/network-request-failed') {
                errorMessage = "Network error. Please check your connection.";
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 overflow-hidden font-inter">
            {/* Animated Mesh Gradient Background */}
            <div className="absolute inset-0 z-0">
                <motion.div 
                    animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                        x: [0, 100, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-violet-600/30 rounded-full blur-[140px]"
                />
                <motion.div 
                    animate={{ 
                        scale: [1, 1.3, 1],
                        rotate: [0, -90, 0],
                        x: [0, -100, 0]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-600/20 rounded-full blur-[140px]"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 100 }}
                className="relative z-10 w-full max-w-[1089px] h-[720px] flex rounded-[48px] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] overflow-hidden mx-4"
            >
                {/* Left Side: Brand Visual */}
                <div className="hidden lg:flex w-[45%] p-20 flex-col justify-between relative bg-white/[0.02]">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-12">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-violet-700 text-2xl font-black shadow-[0_0_40px_rgba(255,255,255,0.3)]">A</div>
                            <span className="text-white font-black text-xl tracking-tighter">AuraSync <span className="text-violet-200">LM</span></span>
                        </div>
                        
                        <h2 className="text-6xl font-black text-white leading-[1.05] tracking-tighter mb-8">
                            Knowledge <br />In Its <br /><span className="text-violet-200">Purest Form.</span>
                        </h2>
                        
                        <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-sm">
                            The ultimate local AI workspace for students and researchers. Weightless organization, infinite insights.
                        </p>
                    </div>

                    <div className="relative z-10 flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-white font-black text-2xl">99%</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Accuracy</span>
                        </div>
                        <div className="w-[1px] h-10 bg-white/10"></div>
                        <div className="flex flex-col">
                            <span className="text-white font-black text-2xl">Local</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Privacy</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Form Card */}
                <div className="flex-1 bg-white p-12 lg:p-20 flex flex-col justify-center relative">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-10">
                            <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-3">
                                {isLogin ? 'Sign In' : 'Create Account'}
                            </h3>
                            <div className="h-1.5 w-12 bg-violet-600 rounded-full mb-4"></div>
                            <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.2em]">
                                {isLogin ? 'Ready to sync your knowledge?' : 'Start your AuraSync journey'}
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            {(error || message) && (
                                <motion.div 
                                    initial={{ opacity: 0, x: -10 }} 
                                    animate={{ opacity: 1, x: 0 }} 
                                    exit={{ opacity: 0 }}
                                    className={`p-4 mb-8 rounded-2xl text-[11px] font-bold flex items-center gap-3 ${error ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-emerald-50 border border-emerald-100 text-emerald-600'}`}
                                >
                                    <span>{error ? '⚠️' : '✅'}</span>
                                    {error || message}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {!isLogin && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Enter name"
                                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-bold"
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-bold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-bold"
                                />
                            </div>

                            <button
                                disabled={loading}
                                type="submit"
                                className="w-full py-5 mt-6 bg-violet-600 text-white rounded-[20px] text-xs font-black uppercase tracking-[0.2em] hover:bg-violet-700 transition-all shadow-2xl shadow-violet-100 disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : (isLogin ? 'Sign In Now' : 'Create My Account')}
                            </button>
                        </form>

                        <div className="mt-10 flex flex-col items-center gap-4">
                            <button
                                onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
                                className="text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em]"
                            >
                                {isLogin ? "Need an account? Sign up" : 'Already a member? Sign in'}
                            </button>
                            
                            <div className="w-8 h-[1px] bg-slate-100"></div>

                            <button
                                onClick={() => {
                                    setUser({
                                        id: 'local_user',
                                        email: 'local@aurasync.offline',
                                        displayName: 'Offline Researcher'
                                    });
                                    toggleAuth();
                                }}
                                className="text-[10px] font-black text-violet-600 hover:text-violet-700 transition-colors uppercase tracking-[0.2em] underline decoration-violet-200 decoration-2 underline-offset-4"
                            >
                                Continue Offline (Privacy Mode)
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
