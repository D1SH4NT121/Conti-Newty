import React from 'react';
import { motion } from 'motion/react';

interface DotGridBackgroundProps {
  className?: string;
  dotSize?: number;
  gap?: number;
  opacity?: number;
  focalOffsetX?: number;
  focalOffsetY?: number;
}

export const DotGridBackground: React.FC<DotGridBackgroundProps> = ({
  className = '',
  dotSize = 1.8,
  gap = 28,
  opacity = 0.09,
  focalOffsetX = 0,
  focalOffsetY = 0,
}) => {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ opacity }}
    >
      <motion.div
        animate={{
          x: focalOffsetX,
          y: focalOffsetY,
        }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-[120%] h-[120%] -top-[10%] -left-[10%]"
        style={{
          backgroundImage: `radial-gradient(circle at center, #1A1714 ${dotSize}px, transparent ${dotSize}px)`,
          backgroundSize: `${gap}px ${gap}px`,
        }}
      />
      {/* Edge gradient mask */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 35%, var(--color-background) 85%)',
        }}
      />
    </div>
  );
};
