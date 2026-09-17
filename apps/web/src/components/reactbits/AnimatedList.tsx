import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AnimatedListProps {
  children: React.ReactNode[];
  className?: string;
  staggerDuration?: number;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  className = '',
  staggerDuration = 0.1,
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      <AnimatePresence>
        {React.Children.map(children, (child, idx) => {
          if (!React.isValidElement(child)) return child;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{
                duration: 0.35,
                delay: idx * staggerDuration,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {child}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
