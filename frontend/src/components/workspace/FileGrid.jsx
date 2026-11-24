import React from 'react';
import { motion } from 'framer-motion';
import FileCard from '../ui/FileCard';

const FileGrid = ({ files, contexts, onFileClick, onContextClick }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6"
        >
            {files.map((file, index) => (
                <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group"
                >
                    <FileCard
                        file={file}
                        contexts={contexts}
                        onFileClick={onFileClick}
                        onContextClick={onContextClick}
                    />
                </motion.div>
            ))}
        </motion.div>
    );
};

export default FileGrid;
