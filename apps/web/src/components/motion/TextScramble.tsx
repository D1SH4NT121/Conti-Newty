import React, { useState, useEffect, useRef } from 'react';
import { useInView } from 'motion/react';

interface TextScrambleProps {
  children: string;
  className?: string;
  characterSet?: string;
  duration?: number;
  speed?: number;
  trigger?: boolean;
  onComplete?: () => void;
  as?: React.ElementType;
}

const DEFAULT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~|}{[]:;?><,./-=';

export const TextScramble: React.FC<TextScrambleProps> = ({
  children,
  className = '',
  characterSet = DEFAULT_CHARS,
  duration = 0.8,
  speed = 0.04,
  trigger = true,
  onComplete,
  as: Component = 'span',
}) => {
  const [displayText, setDisplayText] = useState(children);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (!trigger || !isInView || isRunningRef.current) return;

    // Check reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayText(children);
      onComplete?.();
      return;
    }

    isRunningRef.current = true;
    let frame = 0;
    const totalFrames = Math.max(12, Math.floor((duration * 1000) / (speed * 1000)));

    const interval = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;

      let result = '';
      for (let i = 0; i < children.length; i++) {
        if (children[i] === ' ') {
          result += ' ';
        } else if (i < children.length * progress) {
          result += children[i];
        } else {
          result += characterSet[Math.floor(Math.random() * characterSet.length)];
        }
      }

      setDisplayText(result);

      if (frame >= totalFrames) {
        clearInterval(interval);
        setDisplayText(children);
        isRunningRef.current = false;
        onComplete?.();
      }
    }, speed * 1000);

    return () => clearInterval(interval);
  }, [children, trigger, isInView, duration, speed, characterSet, onComplete]);

  return (
    <Component ref={ref} className={className} aria-label={children}>
      {displayText}
    </Component>
  );
};
