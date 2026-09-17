'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface CardDef {
  id: string;
  name: string;
  badge: string;
  baseXPercent: number;  // 0 to 1 across width
  baseYPercent: number;  // 0 to 1 across height
  side: 'left' | 'right';
  scale: number;
  rotation: number;
  opacity: number;
  bobDuration: number;
  bobDelay: number;
  parallaxFactor: { x: number; y: number };
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
  icon: React.ReactNode;
}

// 6 Asymmetric Source Cards (Zero Row Mirroring, Zero Distance Mirroring, Unique Rotations & Scales)
const CARD_DEFS: CardDef[] = [
  // 1. SLACK — High Left Corner (y ≈ 10%, left ≈ 3%, tilt -9°, scale 1.0)
  {
    id: 'slack',
    name: 'SLACK',
    badge: 'SILOED',
    baseXPercent: 0.04,
    baseYPercent: 0.10,
    side: 'left',
    scale: 1.0,
    rotation: -9,
    opacity: 0.92,
    bobDuration: 6.6,
    bobDelay: 0.2,
    parallaxFactor: { x: -14, y: -10 },
    icon: (
      <svg width="24" height="24" viewBox="0 0 122.8 122.8" className="shrink-0">
        <path fill="#E01E5A" d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z"/>
        <path fill="#E01E5A" d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"/>
        <path fill="#36C5F0" d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z"/>
        <path fill="#36C5F0" d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"/>
        <path fill="#2EB67D" d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z"/>
        <path fill="#2EB67D" d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"/>
        <path fill="#ECB22E" d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z"/>
        <path fill="#ECB22E" d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"/>
      </svg>
    ),
  },
  // 2. GITHUB — Upper-Mid Right (y ≈ 14%, right ≈ 7%, tilt +12°, scale 1.05)
  {
    id: 'github',
    name: 'GITHUB',
    badge: 'NO CONTEXT',
    baseXPercent: 0.91,
    baseYPercent: 0.14,
    side: 'right',
    scale: 1.05,
    rotation: 12,
    opacity: 0.90,
    bobDuration: 7.8,
    bobDelay: 1.4,
    parallaxFactor: { x: 16, y: -10 },
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#e8e8e8" className="shrink-0">
        <path d="M12 2C6.5 2 2 6.5 2 12c0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.3-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.5-1.4.1-2.8 0 0 .8-.3 2.8 1 .8-.2 1.7-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.5.1 2.8.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7 1 .7 2v3c0 .3.2.6.7.5A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10z"/>
      </svg>
    ),
  },
  // 3. JIRA — Upper-Mid Left Indented (y ≈ 34%, left ≈ 12%, tilt -6°, scale 0.98)
  {
    id: 'jira',
    name: 'JIRA',
    badge: 'CLOSED',
    baseXPercent: 0.12,
    baseYPercent: 0.34,
    side: 'left',
    scale: 0.98,
    rotation: -6,
    opacity: 0.90,
    bobDuration: 8.4,
    bobDelay: 2.7,
    parallaxFactor: { x: -12, y: 8 },
    hideOnMobile: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <path d="M11.566 11.53a5.772 5.772 0 0 1-5.772-5.77V0H0v5.76a11.542 11.542 0 0 0 11.566 11.54h5.772v-5.77h-5.772z" fill="#0052CC"/>
        <path d="M12.434 12.47a5.772 5.772 0 0 1 5.772 5.77V24H24v-5.76A11.542 11.542 0 0 0 12.434 6.7h-5.772v5.77h5.772z" fill="#2684FF"/>
        <path d="M11.566 0H5.794a5.772 5.772 0 0 0-5.794 5.76h5.794a5.772 5.772 0 0 1 5.772-5.76z" fill="#2684FF" opacity="0.8"/>
      </svg>
    ),
  },
  // 4. DOCS — Mid-Right Indented (y ≈ 48%, right ≈ 15%, tilt -8°, scale 0.97)
  {
    id: 'docs',
    name: 'DOCS',
    badge: 'STALE',
    baseXPercent: 0.84,
    baseYPercent: 0.48,
    side: 'right',
    scale: 0.97,
    rotation: -8,
    opacity: 0.84,
    bobDuration: 7.2,
    bobDelay: 0.8,
    parallaxFactor: { x: 15, y: 6 },
    hideOnMobile: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
        <path fill="#4285F4" d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"/>
        <path fill="#A1C2FA" d="M15 2v5h5"/>
        <g stroke="#fff" strokeWidth="1.2">
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="8" y1="15.5" x2="16" y2="15.5"/>
          <line x1="8" y1="19" x2="13" y2="19"/>
        </g>
      </svg>
    ),
  },
  // 5. DRIVE — Lower Left Outward (y ≈ 66%, left ≈ 3%, tilt +9°, scale 1.04)
  {
    id: 'drive',
    name: 'DRIVE',
    badge: 'ISOLATED',
    baseXPercent: 0.04,
    baseYPercent: 0.66,
    side: 'left',
    scale: 1.04,
    rotation: 9,
    opacity: 0.84,
    bobDuration: 8.9,
    bobDelay: 2.1,
    parallaxFactor: { x: -18, y: 14 },
    hideOnMobile: true,
    hideOnTablet: true,
    icon: (
      <svg width="26" height="26" viewBox="0 0 87.3 78" className="shrink-0">
        <path fill="#0066DA" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z"/>
        <path fill="#00AC47" d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 47.5C.4 48.9 0 50.45 0 52h27.5z"/>
        <path fill="#EA4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 52c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.87 11.62z"/>
        <path fill="#00832D" d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"/>
        <path fill="#2684FC" d="M59.8 52H27.5L13.75 75.8c1.35.8 2.9 1.2 4.5 1.2h50.9c1.6 0 3.15-.45 4.5-1.2z"/>
        <path fill="#FFBA00" d="M73.4 26.5L60.65 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 52h27.45c0-1.55-.4-3.1-1.2-4.5z"/>
      </svg>
    ),
  },
  // 6. TRIBAL MEMORY — Bottom Right Outward (y ≈ 82%, right ≈ 4%, tilt +4°, scale 1.00)
  {
    id: 'tribal',
    name: 'TRIBAL MEMORY',
    badge: 'LOST',
    baseXPercent: 0.92,
    baseYPercent: 0.82,
    side: 'right',
    scale: 1.0,
    rotation: 4,
    opacity: 0.82,
    bobDuration: 6.8,
    bobDelay: 3.5,
    parallaxFactor: { x: 12, y: 16 },
    hideOnMobile: true,
    hideOnTablet: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff8a80" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
        <path d="M12 3c4 0 5 3 5 5.5S15.5 13 14 13c1.5 1 1 3.5-1 3.5-1.2 0-1.8-.8-2-1.5"/>
        <path d="M12 3c-4 0-5 3-5 5.5S8.5 13 10 13"/>
        <line x1="9" y1="20" x2="15" y2="20" strokeDasharray="0.5 3"/>
      </svg>
    ),
  },
];

interface ResolvedPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HeroAmbientCards: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 });
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  // Update container dimensions on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      }
    };

    updateSize();
    const ro = new ResizeObserver(() => updateSize());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Cursor-reactive parallax handler
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (shouldReduceMotion) return;
    const { innerWidth, innerHeight } = window;
    const x = (e.clientX / innerWidth - 0.5) * 2; // -1 to 1
    const y = (e.clientY / innerHeight - 0.5) * 2; // -1 to 1
    setMouseOffset({ x, y });
  }, [shouldReduceMotion]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // Compute procedurally randomized, de-symmetrized, safe-zone checked card positions
  const cardPositions = useMemo(() => {
    const W = dimensions.width;
    const H = dimensions.height;

    // Responsive Base Card Dimensions
    const baseW = W < 640 ? 116 : W < 1024 ? 134 : 148;
    const baseH = W < 640 ? 76 : W < 1024 ? 82 : 88;

    // Safe Zone: Keep central corridor clear for headline, subhead, and CTA
    // Left boundary of right safe zone & right boundary of left safe zone
    const leftPerimeterMaxX = Math.min(W * 0.24, W / 2 - 220);
    const rightPerimeterMinX = Math.max(W * 0.76, W / 2 + 220);

    const positions: Record<string, ResolvedPosition> = {};

    CARD_DEFS.forEach((card) => {
      const cardWidth = Math.round(baseW * card.scale);
      const cardHeight = Math.round(baseH * card.scale);

      // Calculate initial position based on asymmetric anchor
      let targetX = card.baseXPercent * (W - cardWidth);
      let targetY = card.baseYPercent * (H - cardHeight);

      // Enforce safe zone margins
      if (card.side === 'left') {
        targetX = Math.min(targetX, Math.max(16, leftPerimeterMaxX - cardWidth));
      } else {
        targetX = Math.max(targetX, Math.min(W - cardWidth - 16, rightPerimeterMinX));
      }

      // Bound Y to visible container area with safe margin for bobbing animation
      targetY = Math.max(28, Math.min(H - cardHeight - 24, targetY));

      positions[card.id] = {
        id: card.id,
        x: targetX,
        y: targetY,
        width: cardWidth,
        height: cardHeight,
      };
    });

    // Pairwise collision avoidance check
    const cards = Object.values(positions);
    const minGap = 22;

    for (let iter = 0; iter < 8; iter++) {
      let resolved = true;
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          const a = cards[i];
          const b = cards[j];

          const overlapX = (a.width / 2 + b.width / 2 + minGap) - Math.abs((a.x + a.width / 2) - (b.x + b.width / 2));
          const overlapY = (a.height / 2 + b.height / 2 + minGap) - Math.abs((a.y + a.height / 2) - (b.y + b.height / 2));

          if (overlapX > 0 && overlapY > 0) {
            resolved = false;
            // Push along the shallower axis
            if (overlapY <= overlapX) {
              const shiftY = overlapY / 2 + 1;
              if (a.y < b.y) {
                a.y = Math.max(24, a.y - shiftY);
                b.y = Math.min(H - b.height - 24, b.y + shiftY);
              } else {
                a.y = Math.min(H - a.height - 24, a.y + shiftY);
                b.y = Math.max(24, b.y - shiftY);
              }
            } else {
              const shiftX = overlapX / 2 + 1;
              if (a.x < b.x) {
                a.x = Math.max(16, a.x - shiftX);
                b.x = Math.min(W - b.width - 16, b.x + shiftX);
              } else {
                a.x = Math.min(W - a.width - 16, a.x + shiftX);
                b.x = Math.max(16, b.x - shiftX);
              }
            }
          }
        }
      }
      if (resolved) break;
    }

    return positions;
  }, [dimensions]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-0 overflow-visible"
    >
      {CARD_DEFS.map((card) => {
        const pos = cardPositions[card.id] || { x: 0, y: 0, width: 140, height: 80 };
        const parallaxX = shouldReduceMotion ? 0 : mouseOffset.x * card.parallaxFactor.x;
        const parallaxY = shouldReduceMotion ? 0 : mouseOffset.y * card.parallaxFactor.y;

        return (
          <motion.div
            key={card.id}
            initial={false}
            animate={
              shouldReduceMotion
                ? { x: pos.x, y: pos.y, rotate: card.rotation }
                : {
                    x: pos.x + parallaxX,
                    y: [pos.y + parallaxY - 5, pos.y + parallaxY + 5, pos.y + parallaxY - 5],
                    rotate: [card.rotation - 1.2, card.rotation + 1.2, card.rotation - 1.2],
                  }
            }
            transition={
              shouldReduceMotion
                ? undefined
                : {
                    x: { type: 'spring', damping: 25, stiffness: 60 },
                    y: {
                      duration: card.bobDuration,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: card.bobDelay,
                    },
                    rotate: {
                      duration: card.bobDuration * 1.15,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: card.bobDelay,
                    },
                  }
            }
            style={{
              opacity: card.opacity,
              width: pos.width,
              height: pos.height,
            }}
            className={`absolute top-0 left-0 ${
              card.hideOnMobile ? 'hidden sm:flex' : 'flex'
            } ${
              card.hideOnTablet ? 'hidden lg:flex' : ''
            } flex-col items-center justify-center bg-[#110D0D] border border-red-900/40 rounded-xl px-2.5 py-2 sm:px-3 sm:py-2.5 shadow-[0_0_22px_rgba(220,38,38,0.14)] backdrop-blur-xs select-none`}
          >
            {/* Blinking Red Alarm Badge */}
            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-md animate-pulse">
              !
            </div>

            {/* Brand Logo */}
            <div className="mb-1 flex items-center justify-center">{card.icon}</div>

            {/* Label */}
            <span className="font-mono text-[9.5px] sm:text-[10px] font-semibold tracking-wider text-zinc-200 text-center truncate max-w-full">
              {card.name}
            </span>

            {/* Status Badge */}
            <span className="font-mono text-[7.5px] sm:text-[8px] px-1.5 py-0.5 mt-0.5 rounded-full bg-red-950/70 text-red-300 border border-red-800/50 font-bold tracking-wider">
              {card.badge}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

export default HeroAmbientCards;
