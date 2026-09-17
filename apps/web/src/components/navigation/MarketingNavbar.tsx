import React, { useState, useEffect } from 'react';
import { FlameButton } from '../ui/flame-button';

interface MarketingNavbarProps {
  onEnterWorkspace: () => void;
}

export const MarketingNavbar: React.FC<MarketingNavbarProps> = ({ onEnterWorkspace }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-250 ${
        isScrolled
          ? 'bg-background/90 backdrop-blur-md border-b border-border shadow-xs py-3'
          : 'bg-transparent py-5 border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Brand */}
        <a href="#" className="flex items-center gap-2.5 group">
          <span className="w-2.5 h-2.5 rounded-full bg-foreground animate-pulse" />
          <span className="font-mono text-sm font-bold tracking-widest text-foreground group-hover:text-muted-foreground transition-colors">
            CONTI-NEWTY
          </span>
          <span className="font-mono text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground border border-border rounded">
            v2.4
          </span>
        </a>

        {/* Minimal Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 font-mono text-xs text-muted-foreground">
          <a href="#problem" className="hover:text-foreground transition-colors">Knowledge Shift</a>
          <a href="#traversal" className="hover:text-foreground transition-colors">Live Traversal</a>
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#integrations" className="hover:text-foreground transition-colors">Agent MCP</a>
        </nav>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <FlameButton
            text="ENTER WORKSPACE"
            height={36}
            showArrow={true}
            onClick={onEnterWorkspace}
          />
        </div>
      </div>
    </header>
  );
};
