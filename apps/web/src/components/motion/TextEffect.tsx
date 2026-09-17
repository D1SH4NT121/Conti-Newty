import React, { useRef } from 'react';
import { motion, useInView, type Variants } from 'motion/react';

interface TextEffectProps {
  children: string;
  className?: string;
  per?: 'line' | 'word' | 'char';
  as?: 'div' | 'p' | 'span' | 'h1' | 'h2' | 'h3';
  delay?: number;
  stagger?: number;
  preset?: 'fade-in-blur' | 'fade-in' | 'slide-up';
}

export const TextEffect: React.FC<TextEffectProps> = ({
  children,
  className = '',
  per = 'line',
  as = 'div',
  delay = 0,
  stagger = 0.08,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  let segments: string[] = [];
  if (per === 'line') {
    segments = children.split('\n');
  } else if (per === 'word') {
    segments = children.split(' ');
  } else {
    segments = children.split('');
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: delay,
        staggerChildren: stagger,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 6, filter: 'blur(3px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.42,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  const MotionComponent = (motion as any)[as] || motion.div;

  return (
    <MotionComponent
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={containerVariants}
      className={className}
    >
      {segments.map((seg, i) => (
        <motion.span
          key={i}
          variants={itemVariants}
          className={per === 'line' ? 'block' : 'inline-block'}
          style={per === 'word' ? { marginRight: '0.25em' } : undefined}
        >
          {seg}
        </motion.span>
      ))}
    </MotionComponent>
  );
};
