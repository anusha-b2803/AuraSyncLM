import React from 'react';

const GlassPanel = ({
    children,
    className = '',
    strength = 'normal', // 'normal' or 'strong'
    hover = false,
    ...props
}) => {
    const baseClasses = strength === 'strong' ? 'glass-strong' : 'glass';
    // const hoverClasses = hover ? 'hover-glow' : ''; // Disable hover glow for now as per "no animation" request

    return (
        <div
            className={`${baseClasses} rounded-lg ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};

export default GlassPanel;
