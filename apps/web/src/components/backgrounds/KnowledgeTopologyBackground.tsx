import React from 'react';
import { motion } from 'motion/react';

interface KnowledgeTopologyBackgroundProps {
  className?: string;
  opacity?: number;
}

/**
 * KnowledgeTopologyBackground
 * A disciplined, rule-based architectural topology grid.
 * - Sits strictly behind content at low contrast/opacity.
 * - No scattered diagonals, no stray floating dots, no lines cutting through bordered cards.
 * - Soft radial vignette to ensure seamless visual integration.
 */
export const KnowledgeTopologyBackground: React.FC<KnowledgeTopologyBackgroundProps> = ({
  className = '',
  opacity = 0.06,
}) => {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
      style={{ opacity }}
    >
      {/* Rule-based subtle architectural coordinate grid */}
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id="knowledge-grid-pattern"
            width="64"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            {/* Fine grid lines */}
            <path
              d="M 64 0 L 0 0 0 64"
              fill="none"
              stroke="#1A1714"
              strokeWidth="0.75"
              strokeDasharray="2 6"
            />
            {/* Tiny intersection crosshairs (rule-based at grid intersections only) */}
            <path
              d="M 0 0 L 4 0 M 0 0 L 0 4"
              fill="none"
              stroke="#1A1714"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#knowledge-grid-pattern)" />
      </svg>

      {/* Gentle center-focus vignette so grid subtly fades at margins */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 40%, var(--color-background, #F7F5F0) 90%)',
        }}
      />
    </div>
  );
};
