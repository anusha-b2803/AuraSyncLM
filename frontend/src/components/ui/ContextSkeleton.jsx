import React from 'react';

const ContextSkeleton = ({ count = 5 }) => {
    return (
        <div className="space-y-2 animate-fade-in">
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg skeleton"
                    style={{ animationDelay: `${index * 100}ms` }}
                >
                    <div className="w-8 h-8 rounded-full skeleton" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 skeleton rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
                        <div className="h-3 skeleton rounded" style={{ width: `${40 + Math.random() * 20}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ContextSkeleton;
