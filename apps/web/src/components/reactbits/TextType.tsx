import React, { useState, useEffect, useRef } from 'react';
import { useInView } from 'motion/react';

interface TextTypeProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  cursor?: boolean;
  cursorChar?: string;
  onComplete?: () => void;
  trigger?: boolean;
}

export const TextType: React.FC<TextTypeProps> = ({
  text,
  speed = 35,
  delay = 0,
  className = '',
  cursor = true,
  cursorChar = '▋',
  onComplete,
  trigger = true,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const hasTypedRef = useRef(false);

  useEffect(() => {
    if (!trigger || !isInView || hasTypedRef.current) return;

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayedText(text);
      onComplete?.();
      return;
    }

    hasTypedRef.current = true;
    setIsTyping(true);

    const startTimeout = setTimeout(() => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex <= text.length) {
          setDisplayedText(text.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(interval);
          setIsTyping(false);
          onComplete?.();
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, delay, trigger, isInView, onComplete]);

  return (
    <span ref={ref} className={`inline-block font-mono ${className}`}>
      {displayedText}
      {cursor && isTyping && (
        <span className="animate-pulse text-accent ml-0.5">{cursorChar}</span>
      )}
    </span>
  );
};
