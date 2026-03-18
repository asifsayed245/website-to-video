'use client';

import { motion } from 'framer-motion';
import type { PipelineStep, VideoMode } from '@/lib/types';

interface ProgressTrackerProps {
  currentStep: PipelineStep;
  videoMode?: VideoMode;
}

const ALL_STEPS: { key: PipelineStep; label: string }[] = [
  { key: 'input', label: 'Content' },
  { key: 'script', label: 'Script' },
  { key: 'generating', label: 'Assets' },
  { key: 'generating_clips', label: 'Clips' },
  { key: 'preview', label: 'Preview' },
  { key: 'done', label: 'Export' },
];

export function ProgressTracker({ currentStep, videoMode = 'clips' }: ProgressTrackerProps) {
  // Hide "Clips" step when in images-only mode
  const steps = videoMode === 'images'
    ? ALL_STEPS.filter((s) => s.key !== 'generating_clips')
    : ALL_STEPS;
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="w-full max-w-3xl mx-auto mb-4">
      <div className="glass-panel p-3 flex items-center justify-between gap-1">
        {steps.map((step, i) => {
          const isActive = i === currentIndex;
          const isCompleted = i < currentIndex;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className="relative">
                  {isActive && (
                    <motion.div
                      layoutId="step-glow"
                      className="absolute -inset-1.5 rounded-full bg-accent/20 blur-sm"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <div
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                      isCompleted
                        ? 'bg-emerald-500/80 text-white shadow-sm shadow-emerald-500/30'
                        : isActive
                        ? 'bg-accent text-white shadow-md shadow-accent/30'
                        : 'bg-white/40 text-warm-600 border border-warm-200/50'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                </div>
                <span
                  className={`mt-1.5 text-[10px] font-medium transition-colors ${
                    isActive ? 'text-warm-800' : isCompleted ? 'text-warm-600' : 'text-warm-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 w-full mx-1 rounded-full transition-colors duration-500 ${
                    isCompleted ? 'bg-emerald-500/60' : 'bg-warm-200/50'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
