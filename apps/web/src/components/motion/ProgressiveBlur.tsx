import React from 'react';

interface ProgressiveBlurProps {
  className?: string;
  direction?: 'top' | 'bottom' | 'left' | 'right';
  layers?: number;
}

export const ProgressiveBlur: React.FC<ProgressiveBlurProps> = ({
  className = '',
  direction = 'bottom',
  layers = 6,
}) => {
  const gradientDirection =
    direction === 'bottom'
      ? 'to bottom'
      : direction === 'top'
      ? 'to top'
      : direction === 'right'
      ? 'to right'
      : 'to left';

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      {Array.from({ length: layers }).map((_, i) => {
        const step = (i + 1) / layers;
        const blurAmount = (i + 1) * 2;
        return (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${blurAmount}px)`,
              WebkitBackdropFilter: `blur(${blurAmount}px)`,
              maskImage: `linear-gradient(${gradientDirection}, rgba(0,0,0,0) 0%, rgba(0,0,0,1) ${step * 100}%)`,
              WebkitMaskImage: `linear-gradient(${gradientDirection}, rgba(0,0,0,0) 0%, rgba(0,0,0,1) ${step * 100}%)`,
            }}
          />
        );
      })}
    </div>
  );
};
