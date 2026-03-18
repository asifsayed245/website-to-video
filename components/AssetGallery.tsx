'use client';

import { motion } from 'framer-motion';
import type { AssetJob, CameraDirection } from '@/lib/types';

interface AssetGalleryProps {
  jobs: AssetJob[];
  clipJobs?: AssetJob[];
  cameraDirections?: CameraDirection[];
  isClipStage?: boolean;
  onSkipClips?: () => void;
}

export function AssetGallery({ jobs, clipJobs = [], cameraDirections = [], isClipStage, onSkipClips }: AssetGalleryProps) {
  const imageJobs = jobs.filter((j) => j.type === 'image');
  const audioJobs = jobs.filter((j) => j.type === 'audio');

  const allJobs = isClipStage ? clipJobs : jobs;
  const totalJobs = allJobs.length;
  const doneJobs = allJobs.filter((j) => j.status === 'done').length;
  const failedJobs = allJobs.filter((j) => j.status === 'failed').length;
  const progress = totalJobs > 0 ? Math.round((doneJobs / totalJobs) * 100) : 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-warm-800">
          {isClipStage ? 'Generating Video Clips' : 'Generating Assets'}
        </h2>
        <span className="glass-badge text-xs">
          {doneJobs}/{totalJobs} complete
          {failedJobs > 0 && ` (${failedJobs} failed)`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="glass-panel p-3 mb-6">
        <div className="w-full h-2 bg-warm-200/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-accent to-amber-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-warm-600 mt-2 text-center">
          {isClipStage
            ? 'Converting images to video clips with AI cinematography...'
            : 'Generating images and voiceover audio...'}
        </p>
      </div>

      {/* Video Clips (clip generation stage) */}
      {isClipStage && clipJobs.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-warm-700 mb-2">Video Clips</h3>
          <div className="grid grid-cols-3 gap-3">
            {clipJobs.map((job) => {
              const direction = cameraDirections.find((d) => d.sceneId === job.sceneId);
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card p-3"
                >
                  <div className="aspect-video bg-warm-100/50 rounded-lg overflow-hidden flex items-center justify-center mb-2">
                    {job.status === 'done' && job.resultUrl ? (
                      <video
                        src={job.resultUrl}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    ) : job.status === 'failed' ? (
                      <span className="text-xs text-red-500">Failed</span>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        {/* Animated progress ring */}
                        <svg className="w-8 h-8 animate-spin" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-warm-200/50" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="88" strokeDashoffset="22" strokeLinecap="round" className="text-accent" />
                        </svg>
                        <span className="text-[10px] text-warm-600">Processing</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-warm-600 truncate">{job.sceneId}</p>
                  {direction && (
                    <span className="glass-badge text-[9px] mt-1 inline-block">
                      {direction.movement.replace(/_/g, ' ')}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {onSkipClips && (
            <button
              onClick={onSkipClips}
              className="glass-btn-secondary w-full mt-3 py-2 text-xs"
            >
              Skip Clip Generation (use static images)
            </button>
          )}
        </div>
      )}

      {/* Images */}
      {!isClipStage && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-warm-700 mb-2">B-Roll Images</h3>
          <div className="grid grid-cols-5 gap-2">
            {imageJobs.map((job) => (
              <div
                key={job.id}
                className="aspect-video glass-panel overflow-hidden flex items-center justify-center"
              >
                {job.status === 'done' && job.resultUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={job.resultUrl} alt={job.sceneId} className="w-full h-full object-cover" />
                ) : job.status === 'failed' ? (
                  <span className="text-xs text-red-500">Failed</span>
                ) : (
                  <div className="animate-pulse w-6 h-6 rounded-full bg-warm-200/50" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audio */}
      {!isClipStage && (
        <div>
          <h3 className="text-sm font-semibold text-warm-700 mb-2">Voiceover Audio</h3>
          <div className="space-y-1.5">
            {audioJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 glass-panel px-3 py-2"
              >
                <span className="text-xs text-warm-600 w-20 shrink-0">{job.sceneId}</span>
                <div className="flex-1 h-1.5 bg-warm-200/50 rounded-full overflow-hidden">
                  {job.status === 'done' ? (
                    <div className="h-full bg-emerald-500/80 rounded-full w-full" />
                  ) : job.status === 'failed' ? (
                    <div className="h-full bg-red-400 rounded-full w-full" />
                  ) : (
                    <div className="h-full bg-accent rounded-full w-1/2 animate-pulse" />
                  )}
                </div>
                <span className={`text-xs font-medium ${
                  job.status === 'done' ? 'text-emerald-600' :
                  job.status === 'failed' ? 'text-red-500' : 'text-warm-600'
                }`}>
                  {job.status === 'done' ? 'Ready' : job.status === 'failed' ? 'Failed' : 'Generating...'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
