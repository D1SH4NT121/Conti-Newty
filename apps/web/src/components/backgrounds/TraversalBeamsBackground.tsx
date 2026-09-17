import React from 'react';

interface TraversalBeamsBackgroundProps {
  step?: number;
  className?: string;
  opacity?: number;
}

/**
 * TraversalBeamsBackground
 * A quiet, architectural technical matrix.
 * - No diagonal crossed lines cutting arbitrarily across the viewport.
 * - No horizontal line clashing with the 01–07 state stepper bar.
 * - No free-floating artifact dots.
 * - Recedes cleanly into the background with soft radial edge blending.
 */
export const TraversalBeamsBackground: React.FC<TraversalBeamsBackgroundProps> = ({
  className = '',
  opacity = 0.05,
}) => {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
      style={{ opacity }}
    >
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id="traversal-grid-pattern"
            width="56"
            height="56"
            patternUnits="userSpaceOnUse"
          >
            {/* Consistent architectural technical grid */}
            <path
              d="M 56 0 L 0 0 0 56"
              fill="none"
              stroke="#1A1714"
              strokeWidth="0.75"
              strokeDasharray="2 4"
            />
            {/* Precise corner tick at pattern unit boundaries */}
            <circle cx="0" cy="0" r="0.8" fill="#1A1714" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#traversal-grid-pattern)" />
      </svg>

      {/* Vignette mask to fade the pattern gracefully away from the content */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 35%, var(--color-background, #F7F5F0) 85%)',
        }}
      />
    </div>
  );
};
