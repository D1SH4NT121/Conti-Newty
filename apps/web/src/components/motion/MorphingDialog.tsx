import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface MorphingDialogProps {
  trigger: (open: () => void) => React.ReactNode;
  content: (close: () => void) => React.ReactNode;
  className?: string;
}

export const MorphingDialog: React.FC<MorphingDialogProps> = ({
  trigger,
  content,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {trigger(() => setIsOpen(true))}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              layoutId="morphing-dialog"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-full max-w-2xl bg-card border border-border shadow-2xl p-6 rounded-sm text-foreground overflow-hidden"
            >
              {content(() => setIsOpen(false))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
