import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface FileTreeItem {
  name: string;
  isFolder?: boolean;
  active?: boolean;
  badge?: string;
  children?: FileTreeItem[];
}

interface FolderProps {
  data: FileTreeItem[];
  className?: string;
  defaultOpenAll?: boolean;
}

const TreeNode: React.FC<{ item: FileTreeItem; depth?: number }> = ({ item, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="select-none font-mono text-xs">
      <div
        onClick={() => item.isFolder && setIsOpen(!isOpen)}
        className={`flex items-center justify-between py-1 px-2 rounded-sm cursor-pointer transition-colors ${
          item.active
            ? 'bg-primary/10 text-primary font-semibold'
            : 'text-muted-foreground hover:bg-black/5 hover:text-foreground'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <div className="flex items-center gap-2">
          {item.isFolder && (
            <motion.span
              animate={{ rotate: isOpen ? 90 : 0 }}
              transition={{ duration: 0.15 }}
              className="text-[10px] text-muted-foreground"
            >
              ▶
            </motion.span>
          )}
          {!item.isFolder && <span className="text-muted-foreground/60">📄</span>}
          <span>{item.name}</span>
        </div>
        {item.badge && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-semibold tracking-wider uppercase">
            {item.badge}
          </span>
        )}
      </div>

      <AnimatePresence>
        {item.isFolder && isOpen && item.children && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {item.children.map((child, idx) => (
              <TreeNode key={idx} item={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Folder: React.FC<FolderProps> = ({ data, className = '' }) => {
  return (
    <div className={`space-y-0.5 ${className}`}>
      {data.map((item, idx) => (
        <TreeNode key={idx} item={item} />
      ))}
    </div>
  );
};
