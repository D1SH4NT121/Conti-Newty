import React, { useRef } from 'react';
import { motion, useAnimationFrame } from 'motion/react';

interface Point {
  x: number;
  y: number;
}

interface SourceNode {
  label: string;
  x: number;
  y: number;
  color: string;
  duration: number;
  delay: number;
}

interface HeroConvergenceBeamProps {
  className?: string;
}

// Cubic Bezier Evaluation Function (Mathematically exact 100% on the curve)
function getCubicBezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

// Particle Component mathematically locked to the curve geometry
const TravelingPhoton: React.FC<{
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
  duration: number;
  delay: number;
}> = ({ p0, p1, p2, p3, duration, delay }) => {
  const circleRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);

  useAnimationFrame((time) => {
    if (!circleRef.current) return;
    const durMs = duration * 1000;
    const delayMs = delay * 1000;
    const adjustedTime = (time + delayMs) % durMs;
    const t = adjustedTime / durMs;

    const pt = getCubicBezierPoint(p0, p1, p2, p3, t);

    circleRef.current.setAttribute('cx', pt.x.toFixed(2));
    circleRef.current.setAttribute('cy', pt.y.toFixed(2));

    if (haloRef.current) {
      haloRef.current.setAttribute('cx', pt.x.toFixed(2));
      haloRef.current.setAttribute('cy', pt.y.toFixed(2));
    }

    // Smooth opacity fade in / out at path extremes
    const opacity = t < 0.08 ? (t / 0.08) : t > 0.92 ? ((1 - t) / 0.08) : 1;
    circleRef.current.setAttribute('opacity', opacity.toFixed(2));
    if (haloRef.current) {
      haloRef.current.setAttribute('opacity', (opacity * 0.4).toFixed(2));
    }
  });

  return (
    <g>
      {/* Soft Photon Halo */}
      <circle
        ref={haloRef}
        r="7"
        fill="#FFFFFF"
        filter="url(#core-glow)"
        cx={p0.x}
        cy={p0.y}
        opacity="0"
      />
      {/* Crisp White Photon Core */}
      <circle
        ref={circleRef}
        r="3.5"
        fill="#FFFFFF"
        cx={p0.x}
        cy={p0.y}
        opacity="0"
      />
    </g>
  );
};

export const HeroConvergenceBeam: React.FC<HeroConvergenceBeamProps> = ({ className = '' }) => {
  // Shared target anchor (Center of Convergence Singularity Node)
  const target: Point = { x: 520, y: 190 };

  // Single Source of Truth for all 6 origin nodes & curves
  const sources: SourceNode[] = [
    { label: 'SLACK', x: 80, y: 40, color: '#A1A1AA', duration: 2.6, delay: 0.0 },
    { label: 'GITHUB', x: 50, y: 100, color: '#38BDF8', duration: 2.8, delay: 0.9 },
    { label: 'DRIVE', x: 70, y: 160, color: '#34D399', duration: 2.4, delay: 1.6 },
    { label: 'DOCS', x: 60, y: 220, color: '#E4E4E7', duration: 2.7, delay: 0.4 },
    { label: 'JIRA', x: 80, y: 280, color: '#818CF8', duration: 2.9, delay: 1.2 },
    { label: 'TRIBAL MEMORY', x: 50, y: 340, color: '#F472B6', duration: 2.5, delay: 2.0 },
  ];

  return (
    <div className={`relative w-full h-[420px] overflow-hidden select-none pointer-events-none ${className}`}>
      {/* 1. Dramatic Ambient Bloom Field (Cool Luminous White & Cyan Bloom) */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[340px] rounded-full opacity-25 dark:opacity-40 blur-3xl pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 60% 50%, rgba(255, 255, 255, 0.25) 0%, rgba(56, 189, 248, 0.15) 50%, transparent 75%)',
        }}
      />

      {/* 2. Central Vertical / Diagonal Light Needle */}
      <motion.div
        animate={{
          opacity: [0.4, 0.75, 0.4],
          scaleY: [0.95, 1.05, 0.95],
        }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[520px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-white to-transparent blur-[1px] opacity-60 hidden md:block"
      />

      {/* 3. SVG Light Trails & Convergence Fibers */}
      <svg
        className="w-full h-full"
        viewBox="0 0 700 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="beam-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#71717A" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#A1A1AA" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
          </linearGradient>

          <filter id="core-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Render Each Source Curve with Exact Shared Coordinates */}
        {sources.map((s) => {
          const p0: Point = { x: s.x, y: s.y };
          const p1: Point = { x: s.x + 180, y: s.y };
          const p2: Point = { x: target.x - 160, y: target.y };
          const p3: Point = target;

          const pathData = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

          return (
            <g key={s.label}>
              {/* Base Background Dashed Path */}
              <path
                d={pathData}
                stroke={s.color}
                strokeWidth="1.2"
                strokeDasharray="3 5"
                opacity="0.3"
              />

              {/* Glowing Active Beam Path */}
              <path
                d={pathData}
                stroke="url(#beam-grad)"
                strokeWidth="1.5"
                opacity="0.75"
              />

              {/* Mathematically Locked Traveling Photon */}
              <TravelingPhoton
                p0={p0}
                p1={p1}
                p2={p2}
                p3={p3}
                duration={s.duration}
                delay={s.delay}
              />

              {/* Exact Origin Anchor Dot */}
              <circle
                cx={s.x}
                cy={s.y}
                r="3.5"
                fill={s.color}
                stroke="#1A1714"
                strokeWidth="1"
              />

              {/* Source Label */}
              <text
                x={s.x - 10}
                y={s.y + 3.5}
                fill="currentColor"
                className="text-[9px] font-mono fill-zinc-400 tracking-widest text-right select-none opacity-80"
                textAnchor="end"
              >
                {s.label}
              </text>
            </g>
          );
        })}

        {/* 4. The Focal Singular Company Brain Convergence Singularity Node */}
        <g filter="url(#core-glow)">
          {/* Outermost Luminous Halo */}
          <motion.circle
            cx={target.x}
            cy={target.y}
            r="36"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1"
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: [0.9, 1.3, 0.9], opacity: [0.5, 0.1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Secondary Pulse Ring */}
          <motion.circle
            cx={target.x}
            cy={target.y}
            r="20"
            fill="rgba(255, 255, 255, 0.15)"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Bright White Core Singularity */}
          <circle cx={target.x} cy={target.y} r="8" fill="#FFFFFF" />
          <circle cx={target.x} cy={target.y} r="4" fill="#10B981" />
        </g>

        {/* Output Vector Ray to Company Brain */}
        <path
          d={`M ${target.x} ${target.y} L ${target.x + 140} ${target.y}`}
          stroke="#52525B"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.6"
        />
        <circle cx={target.x + 140} cy={target.y} r="3" fill="#E4E4E7" />

        {/* Sleek Refined Technical Badge */}
        <g transform={`translate(${target.x + 14}, ${target.y - 22})`}>
          <rect
            x="0"
            y="0"
            width="168"
            height="20"
            rx="3"
            fill="#18181B"
            stroke="#27272A"
            strokeWidth="1"
            opacity="0.9"
          />
          <circle cx="10" cy="10" r="2.5" fill="#10B981" />
          <text
            x="18"
            y="13"
            className="text-[9px] font-mono fill-zinc-300 font-medium tracking-wider uppercase"
          >
            COMPANY BRAIN VERIFIED
          </text>
        </g>
      </svg>
    </div>
  );
};
