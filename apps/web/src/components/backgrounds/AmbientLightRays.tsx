import React from 'react';
import { motion } from 'motion/react';

interface AmbientLightRaysProps {
  className?: string;
  opacity?: number;
}

export const AmbientLightRays: React.FC<AmbientLightRaysProps> = ({
  className = '',
  opacity = 0.22,
}) => {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ opacity }}
    >
      {/* Primary warm amber light field */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.7, 1, 0.7],
          rotate: [0, 4, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, rgba(237, 232, 223, 0.45) 0%, rgba(124, 29, 44, 0.28) 40%, rgba(27, 61, 42, 0.12) 65%, transparent 80%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Secondary breathing ray */}
      <motion.div
        animate={{
          scale: [1.05, 0.95, 1.05],
          opacity: [0.5, 0.9, 0.5],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, rgba(124, 29, 44, 0.2) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
};
