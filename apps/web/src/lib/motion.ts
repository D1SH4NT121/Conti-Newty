import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CONTI_MOTION = {
  micro: {
    duration: 0.18,
    ease: [0.22, 1, 0.36, 1] as const,
  },
  content: {
    duration: 0.32,
    ease: [0.22, 1, 0.36, 1] as const,
  },
  reveal: {
    duration: 0.48,
    ease: [0.22, 1, 0.36, 1] as const,
  },
  signature: {
    duration: 0.72,
    ease: [0.22, 1, 0.36, 1] as const,
  },
  stagger: {
    micro: 0.06,
    content: 0.09,
    section: 0.12,
  },
};

export const transitionPreset = {
  ease: [0.22, 1, 0.36, 1],
  duration: 0.4,
};
