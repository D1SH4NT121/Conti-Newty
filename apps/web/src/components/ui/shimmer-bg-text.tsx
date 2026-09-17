"use client";

import React from "react";

export interface ShimmerTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  text?: string;
  className?: string;
}

export const ShimmerText: React.FC<ShimmerTextProps> = ({
  children,
  text,
  className = "",
  ...props
}) => {
  const content = children || text;

  return (
    <span
      className={`relative group inline-block select-none cursor-pointer ${className}`}
      {...props}
    >
      <span
        className="font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400 dark:from-white dark:via-zinc-200 dark:to-white transition-all duration-700 ease-out inline-block"
      >
        {content}
      </span>
      {/* Shimmer overlay on hover */}
      <span
        className="pointer-events-none absolute inset-0 rounded bg-gradient-to-r from-transparent via-black/15 to-transparent dark:via-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer"
        style={{
          mixBlendMode: "overlay",
        }}
      />
    </span>
  );
};

export default ShimmerText;
