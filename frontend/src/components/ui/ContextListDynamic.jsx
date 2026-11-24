import React from 'react';
import { motion } from 'framer-motion';
import SidebarItem from './SidebarItem';

const ContextListDynamic = ({ contexts, selectedContext, onSelectContext }) => {
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -20 },
        show: {
            opacity: 1,
            x: 0,
            transition: {
                type: 'spring',
                stiffness: 300,
                damping: 24,
            },
        },
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-1"
        >
            {contexts.map((context) => (
                <motion.div
                    key={context.id}
                    variants={itemVariants}
                >
                    <SidebarItem
                        icon={context.icon}
                        label={context.name}
                        badge={context.fileCount}
                        active={selectedContext === context.id}
                        onClick={() => onSelectContext(context.id)}
                        onContextMenu={(e) => {
                            // Context menu placeholder
                            console.log('Context menu for:', context.name);
                        }}
                    />
                </motion.div>
            ))}
        </motion.div>
    );
};

export default ContextListDynamic;
