'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AssetJob } from '@/lib/types';

interface ImageLightboxProps {
  images: AssetJob[];
  initialIndex: number;
  onClose: () => void;
  onRegenerate?: (job: AssetJob, description: string) => void;
  isRegenerating?: boolean;
}

export function ImageLightbox({ images, initialIndex, onClose, onRegenerate, isRegenerating }: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [changeDescription, setChangeDescription] = useState('');

  const current = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) setIndex((i) => i - 1);
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (hasNext) setIndex((i) => i + 1);
  }, [hasNext]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept arrow keys when user is typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') onClose();
      if (!isTyping && e.key === 'ArrowLeft') goPrev();
      if (!isTyping && e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  // Lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleRegenerate = () => {
    if (!onRegenerate || !changeDescription.trim() || !current) return;
    onRegenerate(current, changeDescription.trim());
    setChangeDescription('');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors z-10"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Main content area */}
        <div className="flex items-center gap-4 w-full max-w-5xl px-4">
          {/* Prev arrow */}
          <button
            onClick={goPrev}
            disabled={!hasPrev}
            className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              hasPrev
                ? 'bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Image */}
          <div className="flex-1 flex flex-col items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="w-full"
              >
                {current?.resultUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.resultUrl}
                    alt={current.sceneId}
                    className="w-full max-h-[60vh] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Scene info */}
            <div className="mt-4 text-center">
              <p className="text-white/90 font-semibold text-lg">{current?.sceneId}</p>
              <p className="text-white/50 text-sm font-mono mt-1">
                {index + 1} / {images.length}
              </p>
            </div>

            {/* Regeneration bar */}
            {onRegenerate && (
              <div className="mt-4 w-full max-w-lg">
                <div className="flex gap-2 items-center glass-panel p-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <input
                    type="text"
                    value={changeDescription}
                    onChange={(e) => setChangeDescription(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRegenerate(); }}
                    placeholder="Describe the changes..."
                    disabled={isRegenerating}
                    className="flex-1 bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-white/40 transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating || !changeDescription.trim()}
                    className="shrink-0 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isRegenerating ? (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    Redo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Next arrow */}
          <button
            onClick={goNext}
            disabled={!hasNext}
            className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              hasNext
                ? 'bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
