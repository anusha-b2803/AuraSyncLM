import React from 'react';
import { motion } from 'framer-motion';

const ContextChip = ({ name, color, onClick, className = '' }) => {
    return (
        <motion.span
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${className}`}
            style={{
                backgroundColor: `${color}20`,
                color: color,
                border: `1px solid ${color}40`,
            }}
        >
            {name}
        </motion.span>
    );
};

export default ContextChip;
