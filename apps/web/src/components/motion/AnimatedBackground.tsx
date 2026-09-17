import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AnimatedBackgroundProps {
  children: React.ReactNode;
  defaultValue?: string;
  className?: string;
  transition?: any;
  enableHover?: boolean;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  children,
  className = '',
  transition = {
    type: 'spring',
    bounce: 0.12,
    duration: 0.35,
  },
}) => {
  return (
    <div className={`relative ${className}`}>
      {children}
    </div>
  );
};

export const AnimatedBackgroundHighlight: React.FC<{
  layoutId: string;
  className?: string;
}> = ({ layoutId, className = 'absolute inset-0 bg-primary/10 rounded-sm' }) => {
  return (
    <motion.div
      layoutId={layoutId}
      className={className}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 30,
      }}
    />
  );
};
