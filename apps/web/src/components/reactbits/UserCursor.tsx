'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface CursorUser {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
  role?: string;
  x: number;
  y: number;
  lastActive?: number;
  isAiAgent?: boolean;
  statusText?: string;
}

export interface UserCursorProps {
  user: CursorUser;
  containerRef?: React.RefObject<HTMLElement | null>;
  showStatus?: boolean;
}

// React Bits Pro User Cursor Primitive with Live Avatars
export const UserCursor: React.FC<UserCursorProps> = ({ user, showStatus = true }) => {
  const [imgError, setImgError] = useState(false);
  const initial = (user.name?.[0] || 'U').toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{
        opacity: 1,
        scale: 1,
        x: user.x,
        y: user.y,
      }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{
        x: { type: 'spring', damping: 30, stiffness: 220, mass: 0.5 },
        y: { type: 'spring', damping: 30, stiffness: 220, mass: 0.5 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      }}
      className="pointer-events-none fixed top-0 left-0 z-50 flex items-start select-none"
      style={{
        transform: `translate3d(${user.x}px, ${user.y}px, 0)`,
      }}
    >
      {/* SVG Cursor Pointer */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 -translate-x-[2px] -translate-y-[2px] filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
      >
        <path
          d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
          fill={user.color}
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>

      {/* Name Tag & Avatar Badge */}
      <div
        className="ml-1.5 -mt-1 flex flex-col items-start gap-0.5 rounded px-2 py-1 shadow-lg text-[10px] font-mono tracking-tight backdrop-blur-md"
        style={{
          backgroundColor: user.color,
          color: '#ffffff',
          boxShadow: `0 4px 14px ${user.color}45`,
        }}
      >
        <div className="flex items-center gap-1.5 font-semibold">
          {user.avatarUrl && !imgError ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              onError={() => setImgError(true)}
              className="w-3.5 h-3.5 rounded-full object-cover border border-white/40 shrink-0"
            />
          ) : user.isAiAgent ? (
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full bg-black/25 flex items-center justify-center text-[8px] font-bold shrink-0">
              {initial}
            </span>
          )}
          <span className="truncate max-w-[120px]">{user.name}</span>
          {user.role && (
            <span className="opacity-80 text-[8px] font-normal uppercase">
              [{user.role}]
            </span>
          )}
        </div>

        {showStatus && user.statusText && (
          <div className="text-[9px] opacity-90 font-sans font-normal truncate max-w-[160px]">
            {user.statusText}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default UserCursor;
