import React, { useState, useEffect, useRef } from 'react';
import { useInView } from 'motion/react';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  parentClassName?: string;
  animateOn?: 'view' | 'hover';
  onComplete?: () => void;
}

const DEFAULT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><,./-=';

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  speed = 40,
  maxIterations = 10,
  sequential = true,
  characters = DEFAULT_CHARS,
  className = '',
  parentClassName = '',
  animateOn = 'view',
  onComplete,
}) => {
  const [displayText, setDisplayText] = useState(text);
  const [isHovering, setIsHovering] = useState(false);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, { once: true });
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    const shouldAnimate = animateOn === 'view' ? (isInView && !hasAnimatedRef.current) : isHovering;
    if (!shouldAnimate) return;

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayText(text);
      setIsDecrypted(true);
      onComplete?.();
      return;
    }

    hasAnimatedRef.current = true;
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText((prev) =>
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (sequential && index < iteration / maxIterations * text.length) {
              return text[index];
            }
            if (!sequential && iteration >= maxIterations) {
              return text[index];
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join('')
      );

      iteration++;
      if (iteration > maxIterations * (sequential ? text.length : 1)) {
        clearInterval(interval);
        setDisplayText(text);
        setIsDecrypted(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [isInView, isHovering, text, speed, maxIterations, sequential, characters, animateOn, onComplete]);

  return (
    <span
      ref={containerRef}
      className={`inline-block ${parentClassName}`}
      onMouseEnter={() => animateOn === 'hover' && setIsHovering(true)}
      onMouseLeave={() => animateOn === 'hover' && setIsHovering(false)}
    >
      <span className={className}>{displayText}</span>
    </span>
  );
};
