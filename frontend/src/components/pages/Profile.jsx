import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../../contexts/AppStateContext';
import { auth } from '../../utils/firebase';
import { updatePassword, updateEmail } from 'firebase/auth';

const API_BASE_URL = window.API_CONFIG ? `http://127.0.0.1:${window.API_CONFIG.port}` : 'http://127.0.0.1:8000';
const getHeaders = (extra = {}) => ({
    ...(window.API_CONFIG ? { 'Authorization': `Bearer ${window.API_CONFIG.token}` } : {}),
    ...extra
});

const Profile = () => {
    const { state, updateUserProfile, setUser } = useAppState();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    const [localProfile, setLocalProfile] = useState({
        name: state.userProfile?.name || state.user?.displayName || 'User',
        email: state.userProfile?.email || state.user?.email || '',
        bio: state.userProfile?.bio || '',
        avatar: state.userProfile?.avatar || state.user?.photoURL || null,
    });

    const [passwordData, setPasswordData] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const fileInputRef = useRef(null);

    React.useEffect(() => {
        if (!isEditing) {
            setLocalProfile({
                name: state.userProfile?.name || state.user?.displayName || 'User',
                email: state.userProfile?.email || state.user?.email || '',
                bio: state.userProfile?.bio || '',
                avatar: state.userProfile?.avatar || state.user?.photoURL || null,
            });
        }
    }, [state.userProfile, state.user, isEditing]);

    const handleSave = async () => {
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            if (localProfile.email !== (state.user?.email || '')) {
                await updateEmail(auth.currentUser, localProfile.email);
            }
            await updateUserProfile(localProfile);
            setIsEditing(false);
            setMessage({ type: 'success', text: 'Profile updated successfully.' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' });
            return;
        }
        setLoading(true);
        try {
            await updatePassword(auth.currentUser, passwordData.newPassword);
            setShowPasswordChange(false);
            setPasswordData({ newPassword: '', confirmPassword: '' });
            setMessage({ type: 'success', text: 'Password updated successfully.' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to update password.' });
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLocalProfile(prev => ({ ...prev, avatar: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSignOut = async () => {
        try {
            await auth.signOut();
            setUser(null);
        } catch (err) {
            console.error("Sign out error:", err);
        }
    };

    const handleResetKnowledgeBase = async () => {
        if (!window.confirm("Are you sure? This will PERMANENTLY delete your indexed research and organized files for this account. Your original source files will NOT be affected.")) return;
        
        setLoading(true);
        try {
            const userId = state.user?.uid || 'default';
            const res = await fetch(`${API_BASE_URL}/system/reset?userId=${userId}`, { method: 'POST', headers: getHeaders() });
            if (!res.ok) throw new Error('Reset failed');
            setMessage({ type: 'success', text: 'Knowledge base purged successfully.' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name) => {
        return name ? name.charAt(0).toUpperCase() : 'U';
    };

    return (
        <div className="h-full bg-white overflow-y-auto custom-scrollbar font-inter">
            {/* Simple Header */}
            <div className="px-12 py-10 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Account Settings</h2>
                    <p className="text-sm text-slate-500 mt-1">Manage your personal information and security</p>
                </div>
                <div className="flex gap-3">
                    {!isEditing && (
                        <button 
                            onClick={handleSignOut}
                            className="px-6 py-2.5 text-slate-500 text-sm font-semibold hover:bg-slate-50 rounded-xl transition-all"
                        >
                            Sign Out
                        </button>
                    )}
                    <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${isEditing ? 'bg-slate-100 text-slate-600' : 'bg-violet-600 text-white shadow-lg shadow-violet-200'}`}
                    >
                        {isEditing ? 'Cancel' : 'Edit Profile'}
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-12 py-12">
                <AnimatePresence>
                    {message.text && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className={`p-4 mb-8 rounded-xl text-sm font-medium flex items-center gap-3 ${message.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}
                        >
                            {message.type === 'error' ? '✕' : '✓'} {message.text}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-col md:flex-row gap-16">
                    {/* Profile Section */}
                    <div className="w-full md:w-1/3 flex flex-col items-center">
                        <div className="relative group">
                            <div className="w-40 h-40 rounded-full bg-slate-100 flex items-center justify-center text-5xl font-bold text-slate-400 overflow-hidden border-4 border-white shadow-sm">
                                {localProfile.avatar ? (
                                    <img src={localProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    getInitials(localProfile.name)
                                )}
                            </div>
                            {isEditing && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all text-slate-600"
                                >
                                    📷
                                </button>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                        </div>
                        <div className="mt-6 text-center">
                            <h3 className="text-xl font-bold text-slate-900">{localProfile.name}</h3>
                            <p className="text-sm text-slate-500 mt-1">{localProfile.email}</p>
                        </div>
                    </div>

                    {/* Form Section */}
                    <div className="flex-1 space-y-10">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                                    <input
                                        type="text"
                                        disabled={!isEditing}
                                        value={localProfile.name}
                                        onChange={(e) => setLocalProfile({...localProfile, name: e.target.value})}
                                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-violet-300 transition-all disabled:opacity-60"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
                                    <input
                                        type="email"
                                        disabled={!isEditing}
                                        value={localProfile.email}
                                        onChange={(e) => setLocalProfile({...localProfile, email: e.target.value})}
                                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-violet-300 transition-all disabled:opacity-60"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">About (Bio)</label>
                                <textarea
                                    disabled={!isEditing}
                                    value={localProfile.bio}
                                    onChange={(e) => setLocalProfile({...localProfile, bio: e.target.value})}
                                    rows={3}
                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-violet-300 transition-all resize-none disabled:opacity-60"
                                    placeholder="Tell us a bit about yourself..."
                                />
                            </div>

                            {isEditing && (
                                <button 
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="w-full py-3.5 bg-violet-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            )}
                        </div>

                        {/* Security Section */}
                        <div className="pt-10 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Security</h4>
                                {!showPasswordChange && (
                                    <button 
                                        onClick={() => setShowPasswordChange(true)}
                                        className="text-xs font-bold text-violet-600 hover:text-violet-700"
                                    >
                                        Change Password
                                    </button>
                                )}
                            </div>

                            {showPasswordChange && (
                                <form onSubmit={handleChangePassword} className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">New Password</label>
                                            <input
                                                type="password"
                                                required
                                                value={passwordData.newPassword}
                                                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-violet-300"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Confirm New Password</label>
                                            <input
                                                type="password"
                                                required
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-violet-300"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all">
                                            {loading ? 'Updating...' : 'Update Password'}
                                        </button>
                                        <button type="button" onClick={() => setShowPasswordChange(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
