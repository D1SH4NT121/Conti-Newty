import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AnimatedContentProps {
  children: React.ReactNode;
  contentKey: string | number;
  className?: string;
  direction?: 'horizontal' | 'vertical';
}

export const AnimatedContent: React.FC<AnimatedContentProps> = ({
  children,
  contentKey,
  className = '',
  direction = 'vertical',
}) => {
  return (
    <div className={`relative ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={contentKey}
          initial={{
            opacity: 0,
            y: direction === 'vertical' ? 8 : 0,
            x: direction === 'horizontal' ? 8 : 0,
          }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{
            opacity: 0,
            y: direction === 'vertical' ? -8 : 0,
            x: direction === 'horizontal' ? -8 : 0,
          }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
