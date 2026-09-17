import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SlidingNumberProps {
  value: number | string;
  className?: string;
}

export const SlidingNumber: React.FC<SlidingNumberProps> = ({
  value,
  className = '',
}) => {
  const characters = String(value).split('');

  return (
    <span className={`inline-flex items-center overflow-hidden font-mono ${className}`}>
      {characters.map((char, index) => {
        if (!isNaN(Number(char))) {
          return (
            <span key={index} className="relative inline-block h-[1em] w-[0.6em] overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={char}
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: '0%', opacity: 1 }}
                  exit={{ y: '-100%', opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {char}
                </motion.span>
              </AnimatePresence>
            </span>
          );
        }
        return <span key={index}>{char}</span>;
      })}
    </span>
  );
};
