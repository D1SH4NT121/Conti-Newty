import React from 'react';

interface AnimatedBackgroundLinesProps {
  className?: string;
  children?: React.ReactNode;
}

export const AnimatedBackgroundLines: React.FC<AnimatedBackgroundLinesProps> = ({
  className = '',
  children,
}) => {
  const lineWrapperTops = ['top-[10%]', 'top-[30%]', 'top-[50%]', 'top-[70%]', 'top-[90%]'];

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      {/* Grid Background */}
      <div
        className="absolute inset-0 w-full h-full bg-[linear-gradient(rgba(255,149,0,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,149,0,0.06)_1px,transparent_1px)] bg-[length:50px_50px] animate-[gridMove_20s_linear_infinite] z-0 pointer-events-none"
      />

      {/* Animated Background Horizontal Beams */}
      <div className="absolute inset-0 w-full h-full overflow-hidden z-[1] pointer-events-none">
        {lineWrapperTops.map((topClass, index) => (
          <div key={index} className={`absolute w-full h-[100px] ${topClass}`}>
            <div className="w-full h-0.5 relative overflow-hidden">
              <div
                className={`absolute top-0 w-full h-full animate-[lineMove_4s_linear_infinite] ${
                  index % 2 !== 0 ? '[animation-direction:reverse] [animation-delay:2s]' : ''
                }`}
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,149,0,0.8) 20%, #ffd700 50%, rgba(255,149,0,0.8) 80%, transparent 100%)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Corner Lines - visible on md and up */}
      <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[120px] z-[5] pointer-events-none">
        <svg
          className="absolute top-1/2 -translate-y-1/2 left-[-150px] w-[120px] h-[60px] animate-[cornerLineAnimation_6s_linear_infinite]"
          viewBox="0 0 120 60"
          stroke="#ff9500"
          strokeWidth="2"
          fill="none"
          strokeDasharray="50"
        >
          <path d="M120 0 L20 0 Q0 0 0 20 L0 60" />
        </svg>
        <svg
          className="absolute top-1/2 -translate-y-1/2 right-[-150px] w-[120px] h-[60px] transform scale-x-[-1] animate-[cornerLineAnimation_6s_linear_infinite] [animation-delay:3s]"
          viewBox="0 0 120 60"
          stroke="#ff9500"
          strokeWidth="2"
          fill="none"
          strokeDasharray="50"
        >
          <path d="M120 0 L20 0 Q0 0 0 20 L0 60" />
        </svg>
      </div>

      {/* Content wrapper */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
};

export default AnimatedBackgroundLines;
