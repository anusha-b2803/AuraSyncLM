import React from 'react';

const ChatBubble = ({ message }) => {
    const isUser = message.type === 'user';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} fade-in`}>
            <div className={`
                max-w-[85%] p-6 rounded-[28px] shadow-2xl transition-all
                ${isUser
                    ? 'bg-white text-slate-950 rounded-br-none'
                    : 'bg-white/[0.03] border border-white/5 text-slate-300 rounded-bl-none backdrop-blur-xl'
                }
            `}>
                <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap">{message.content}</p>
                {message.timestamp && (
                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] mt-3 block ${isUser ? 'text-slate-500' : 'text-slate-600'}`}>
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
        </div>
    );
};

export default ChatBubble;
