"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "../../lib/utils";
import PredictiveArc from "../originkit/ui/predictive-arc";

// Register ScrollTrigger safely for React
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// -------------------------------------------------------------------------
// 1. THEME-ADAPTIVE INLINE STYLES
// -------------------------------------------------------------------------
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap');

.cinematic-footer-wrapper {
  font-family: 'Plus Jakarta Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
  
  /* Dynamic Variables using standard shadcn/tailwind v4 tokens */
  --pill-bg-1: color-mix(in oklch, var(--foreground) 3%, transparent);
  --pill-bg-2: color-mix(in oklch, var(--foreground) 1%, transparent);
  --pill-shadow: color-mix(in oklch, var(--background) 50%, transparent);
  --pill-highlight: color-mix(in oklch, var(--foreground) 10%, transparent);
  --pill-inset-shadow: color-mix(in oklch, var(--background) 80%, transparent);
  --pill-border: color-mix(in oklch, var(--foreground) 8%, transparent);
  
  --pill-bg-1-hover: color-mix(in oklch, var(--foreground) 8%, transparent);
  --pill-bg-2-hover: color-mix(in oklch, var(--foreground) 2%, transparent);
  --pill-border-hover: color-mix(in oklch, var(--foreground) 20%, transparent);
  --pill-shadow-hover: color-mix(in oklch, var(--background) 70%, transparent);
  --pill-highlight-hover: color-mix(in oklch, var(--foreground) 20%, transparent);
}

@keyframes footer-breathe {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
  100% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
}

@keyframes footer-scroll-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes footer-heartbeat {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(255, 161, 0, 0.5)); }
  15%, 45% { transform: scale(1.2); filter: drop-shadow(0 0 10px rgba(255, 161, 0, 0.8)); }
  30% { transform: scale(1); }
}

.animate-footer-breathe {
  animation: footer-breathe 8s ease-in-out infinite alternate;
}

.animate-footer-scroll-marquee {
  animation: footer-scroll-marquee 40s linear infinite;
}

.animate-footer-heartbeat {
  animation: footer-heartbeat 2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

/* Theme-adaptive Grid Background */
.footer-bg-grid {
  background-size: 60px 60px;
  background-image: 
    linear-gradient(to right, color-mix(in oklch, var(--foreground) 3%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 3%, transparent) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
}

/* Glass Pill Theming */
.footer-glass-pill {
  background: rgba(24, 21, 21, 0.75);
  box-shadow: 
      0 10px 30px -10px rgba(0, 0, 0, 0.8), 
      inset 0 1px 1px rgba(255, 255, 255, 0.15), 
      inset 0 -1px 2px rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.footer-glass-pill:hover {
  background: rgba(35, 30, 30, 0.9);
  border-color: rgba(255, 161, 0, 0.4);
  box-shadow: 
      0 20px 40px -10px rgba(0, 0, 0, 0.9), 
      inset 0 1px 1px rgba(255, 255, 255, 0.3),
      0 0 20px rgba(255, 161, 0, 0.2);
  color: #FFFFFF;
}

/* Giant Background Text Masking */
.footer-giant-bg-text {
  font-size: clamp(2.8rem, 14.2vw, 14.8vw);
  line-height: 0.8;
  font-weight: 900;
  letter-spacing: -0.045em;
  color: transparent;
  -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.1);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, transparent 65%);
  -webkit-background-clip: text;
  background-clip: text;
  width: 98vw;
  text-align: center;
}

/* Metallic Text Glow */
.footer-text-glow {
  background: linear-gradient(180deg, #FFFFFF 0%, rgba(255, 255, 255, 0.6) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0px 0px 25px rgba(255, 161, 0, 0.25));
}
`;

// -------------------------------------------------------------------------
// 2. MAGNETIC BUTTON PRIMITIVE (Zero Dependency)
// -------------------------------------------------------------------------
export type MagneticButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & 
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as?: React.ElementType;
  };

const MagneticButton = React.forwardRef<HTMLElement, MagneticButtonProps>(
  ({ className, children, as: Component = "button", ...props }, forwardedRef) => {
    const localRef = useRef<HTMLElement>(null);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const element = localRef.current;
      if (!element) return;

      const ctx = gsap.context(() => {
        const handleMouseMove = (e: MouseEvent) => {
          const rect = element.getBoundingClientRect();
          const h = rect.width / 2;
          const w = rect.height / 2;
          const x = e.clientX - rect.left - h;
          const y = e.clientY - rect.top - w;

          gsap.to(element, {
            x: x * 0.4,
            y: y * 0.4,
            rotationX: -y * 0.15,
            rotationY: x * 0.15,
            scale: 1.05,
            ease: "power2.out",
            duration: 0.4,
          });
        };

        const handleMouseLeave = () => {
          gsap.to(element, {
            x: 0,
            y: 0,
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            ease: "elastic.out(1, 0.3)",
            duration: 1.2,
          });
        };

        element.addEventListener("mousemove", handleMouseMove as any);
        element.addEventListener("mouseleave", handleMouseLeave);

        return () => {
          element.removeEventListener("mousemove", handleMouseMove as any);
          element.removeEventListener("mouseleave", handleMouseLeave);
        };
      }, element);

      return () => ctx.revert();
    }, []);

    return (
      <Component
        ref={(node: HTMLElement) => {
          (localRef as any).current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) (forwardedRef as any).current = node;
        }}
        className={cn("cursor-pointer", className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
MagneticButton.displayName = "MagneticButton";

// -------------------------------------------------------------------------
// 3. MAIN COMPONENT
// -------------------------------------------------------------------------
const MarqueeItem = () => (
  <div className="flex items-center space-x-12 px-6">
    <span>Git-Backed Truth</span> <span className="text-[#FFA100]">✦</span>
    <span>AST Traversal</span> <span className="text-[#FBDA0C]">✦</span>
    <span>Cryptographic Enclaves</span> <span className="text-[#FFA100]">✦</span>
    <span>Model Context Protocol</span> <span className="text-[#FBDA0C]">✦</span>
    <span>Zero Hallucination</span> <span className="text-[#FFA100]">✦</span>
    <span>Permanent Context</span> <span className="text-[#FBDA0C]">✦</span>
  </div>
);

export interface CinematicFooterProps {
  onEnterWorkspace?: () => void;
}

export function CinematicFooter({ onEnterWorkspace }: CinematicFooterProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const giantTextRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!wrapperRef.current) return;

    // React strict mode compatible GSAP context cleanup
    const ctx = gsap.context(() => {
      // Background Parallax
      gsap.fromTo(
        giantTextRef.current,
        { y: "10vh", scale: 0.8, opacity: 0 },
        {
          y: "0vh",
          scale: 1,
          opacity: 1,
          ease: "power1.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 80%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );

      // Staggered Content Reveal
      gsap.fromTo(
        [headingRef.current, linksRef.current],
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 40%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      
      {/* 
        The "Curtain Reveal" Wrapper:
        It sits in standard flow. Because it has clip-path, its contents
        are ONLY visible within its bounding box. 
      */}
      <div
        ref={wrapperRef}
        className="relative min-h-[90vh] md:min-h-screen w-full"
        style={{ clipPath: "polygon(0% 0, 100% 0%, 100% 100%, 0 100%)" }}
      >
        {/* The actual footer stays fixed to the viewport underneath everything */}
        <footer className="fixed bottom-0 left-0 flex min-h-[90vh] md:h-screen w-full flex-col justify-between overflow-hidden bg-[#181515] text-[#F4F1EA] cinematic-footer-wrapper">
          
          {/* Yellow Rising Arc Horizon Background Effect (OriginKit Predictive Arc) */}
          <div className="absolute inset-0 z-0 pointer-events-auto">
            <PredictiveArc
              background="#181515"
              baseColor="#FFA100"
              accentColor="#FBDA0C"
              highlight="#FFC400"
              density={120}
              dotSize={380}
              speed={100}
              arch={{ peak: 35, archHeight: 70, thickness: 160, falloff: 250 }}
              pointer={{ enabled: true, radius: 240, strength: 60 }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
              }}
            />
          </div>

          {/* Grid Background Overlay */}
          <div className="footer-bg-grid absolute inset-0 z-0 pointer-events-none opacity-40" />

          {/* Giant background text */}
          <div
            ref={giantTextRef}
            className="footer-giant-bg-text absolute -bottom-[2vh] left-1/2 -translate-x-1/2 whitespace-nowrap z-0 pointer-events-none select-none tracking-tight font-sans font-black"
          >
            CONTI-NEWTY
          </div>

          {/* 1. Diagonal Sleek Marquee (Top of footer) */}
          <div className="absolute top-10 md:top-12 left-0 w-full overflow-hidden border-y border-white/10 bg-[#181515]/75 backdrop-blur-md py-3 md:py-4 z-10 -rotate-2 scale-110 shadow-2xl">
            <div className="flex w-max animate-footer-scroll-marquee text-xs md:text-sm font-mono font-bold tracking-[0.3em] text-zinc-300 uppercase">
              <MarqueeItem />
              <MarqueeItem />
            </div>
          </div>

          {/* 2. Main Center Content */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 mt-24 md:mt-20 w-full max-w-5xl mx-auto pointer-events-none">
            <h2
              ref={headingRef}
              className="text-5xl md:text-8xl font-black footer-text-glow tracking-tighter mb-8 md:mb-12 text-center text-white"
            >
              Ready to begin?
            </h2>

            {/* Interactive Magnetic Pills Layout */}
            <div ref={linksRef} className="flex flex-col items-center gap-5 md:gap-6 w-full pointer-events-auto">
              {/* Primary Action Button */}
              <div className="flex justify-center w-full">
                <MagneticButton 
                  as="button" 
                  onClick={onEnterWorkspace}
                  className="footer-glass-pill px-10 md:px-12 py-4 md:py-5 rounded-full text-white font-bold text-base md:text-lg flex items-center gap-3.5 group shadow-xl hover:border-[#FFA100]/60 transition-all"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFA100] group-hover:scale-125 transition-transform" />
                  <span>Launch Workspace</span>
                  <svg className="w-5 h-5 text-zinc-400 group-hover:text-[#FFA100] group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </MagneticButton>
              </div>

              {/* Secondary Text Links */}
              <div className="flex flex-wrap justify-center gap-3 md:gap-6 w-full mt-2 font-mono text-xs">
                <MagneticButton as="a" href="#problem" className="footer-glass-pill px-5 py-2.5 rounded-full text-zinc-300 font-medium hover:text-white">
                  Problem
                </MagneticButton>
                <MagneticButton as="a" href="#traversal" className="footer-glass-pill px-5 py-2.5 rounded-full text-zinc-300 font-medium hover:text-white">
                  Mechanism
                </MagneticButton>
                <MagneticButton as="a" href="#features" className="footer-glass-pill px-5 py-2.5 rounded-full text-zinc-300 font-medium hover:text-white">
                  Features
                </MagneticButton>
                <MagneticButton as="a" href="#integrations" className="footer-glass-pill px-5 py-2.5 rounded-full text-zinc-300 font-medium hover:text-white">
                  Protocol SDK
                </MagneticButton>
              </div>

              {/* Copyright - Positioned Just Above CONTI-NEWTY */}
              <div className="mt-4 md:mt-6 text-center text-zinc-400 font-mono text-[10px] md:text-xs font-semibold tracking-widest uppercase">
                © 2026 CONTI-NEWTY. ALL RIGHTS RESERVED.
              </div>
            </div>
          </div>

          {/* 3. Bottom Float Controls */}
          <div className="absolute bottom-6 right-6 md:right-12 z-20">
            {/* Back to top */}
            <MagneticButton
              as="button"
              onClick={scrollToTop}
              className="w-11 h-11 rounded-full footer-glass-pill flex items-center justify-center text-zinc-300 hover:text-white group shadow-lg"
              title="Back to top"
            >
              <svg className="w-5 h-5 transform group-hover:-translate-y-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </MagneticButton>
          </div>
        </footer>
      </div>
    </>
  );
}

export default CinematicFooter;
