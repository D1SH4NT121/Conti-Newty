import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TextMorphProps {
  children: string;
  className?: string;
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3';
}

export const TextMorph: React.FC<TextMorphProps> = ({
  children,
  className = '',
  as = 'span',
}) => {
  const MotionComponent = (motion as any)[as] || motion.span;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <MotionComponent
        key={children}
        initial={{ opacity: 0, y: -4, filter: 'blur(2px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={`inline-block ${className}`}
      >
        {children}
      </MotionComponent>
    </AnimatePresence>
  );
};
