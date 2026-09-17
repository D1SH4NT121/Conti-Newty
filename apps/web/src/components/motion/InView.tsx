import React, { useRef } from 'react';
import { motion, useInView, type Transition, type Variant } from 'motion/react';

interface InViewProps {
  children: React.ReactNode;
  variants?: {
    hidden: Variant;
    visible: Variant;
  };
  transition?: Transition;
  viewOptions?: {
    once?: boolean;
    margin?: string;
    amount?: 'some' | 'all' | number;
  };
  className?: string;
  as?: 'div' | 'section' | 'article' | 'span' | 'p' | 'header' | 'footer';
}

const defaultVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

export const InView: React.FC<InViewProps> = ({
  children,
  variants = defaultVariants,
  transition = { duration: 0.48, ease: [0.22, 1, 0.36, 1] },
  viewOptions = { once: true, amount: 0.15 },
  className = '',
  as = 'div',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    once: viewOptions.once,
    amount: viewOptions.amount,
  });

  const MotionComponent = (motion as any)[as] || motion.div;

  return (
    <MotionComponent
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={transition}
      className={className}
    >
      {children}
    </MotionComponent>
  );
};
