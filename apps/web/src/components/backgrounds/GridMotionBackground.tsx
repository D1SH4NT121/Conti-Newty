import React from 'react';
import { motion } from 'motion/react';

interface GridMotionBackgroundProps {
  className?: string;
  gridSize?: number;
  opacity?: number;
}

export const GridMotionBackground: React.FC<GridMotionBackgroundProps> = ({
  className = '',
  gridSize = 40,
  opacity = 0.08,
}) => {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ opacity }}
    >
      <motion.div
        initial={{ x: 0, y: 0 }}
        animate={{ x: [0, -gridSize], y: [0, -gridSize] }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="w-[120%] h-[120%] -top-[10%] -left-[10%]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, #1A1714 1.5px, transparent 0),
            linear-gradient(to right, rgba(26, 23, 20, 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(26, 23, 20, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px`,
        }}
      />
      {/* Edge gradient vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 40%, transparent 25%, var(--color-background) 80%)',
        }}
      />
    </div>
  );
};
